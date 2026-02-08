import { SNAPSHOT_DATE } from "@/constants";
import { db } from "@/db/db";
import { campaignTypes } from "@/db/enum";
import { affiliateClicksDB } from "@/db/modules/affiliateClicks.db";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import {
  buildClaimOverview,
  insertClaimRowTx,
  markNftRowsClaimedTx,
  markScoreRowsClaimedTx,
} from "@/db/modules/claimOnion.db";
import tokenCampaignClaimOnionDB from "@/db/modules/tokenCampaignClaimOnion.db";
import userEligibilityDB from "@/db/modules/tokenCampaignEligibleUsers.db";
import tokenCampaignMergeTransactionsDB from "@/db/modules/tokenCampaignMergeTransactions.db";
import { tokenCampaignNftCollectionsDB } from "@/db/modules/tokenCampaignNftCollections.db";
import { tokenCampaignNftItemsDB } from "@/db/modules/tokenCampaignNftItems.db";
import { tokenCampaignOrdersDB } from "@/db/modules/tokenCampaignOrders.db";
import { tokenCampaignSpinPackagesDB } from "@/db/modules/tokenCampaignSpinPackages.db";
import { tokenCampaignUserSpinsDB } from "@/db/modules/tokenCampaignUserSpins.db";
import { TokenCampaignClaimOnionInsert } from "@/db/schema/tokenCampaignClaimOnion";
import { TokenCampaignOrdersInsert, TokenCampaignOrdersStatus } from "@/db/schema/tokenCampaignOrders";
import { checkRateLimit } from "@/lib/checkRateLimit";
import { generateRandomHash } from "@/lib/generateRandomHash";
import { redisTools } from "@/lib/redisTools";
import { secureWeightedRandom } from "@/lib/secureWeightedRandom";
import { is_prod_env } from "@/server/utils/evnutils";
import { logger } from "@/server/utils/logger";
import tonCenter, { NFTItem } from "@/services/tonCenter";
import { CampaignNFT } from "@/types/campaign.types";
import { Address } from "@ton/core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { initDataProtectedProcedure, router, walletJWTProtectedProcedure } from "../trpc";

export const campaignRouter = router({
  /**
   * Get Campaign Collections by Type
   * Receives a `campaignType` and returns matching collections.
   */
  getCollectionsByCampaignType: initDataProtectedProcedure
    .input(
      z.object({
        campaignType: z.enum(campaignTypes.enumValues),
        affiliateHash: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { campaignType, affiliateHash } = input;
      const userId = ctx.user?.user_id;
      if (affiliateHash) {
        await affiliateClicksDB.enqueueClick(affiliateHash, userId);
      }
      return tokenCampaignNftCollectionsDB.getCollectionsByCampaignTypeSecure(campaignType);
    }),
  /**
   * Get *active* spin packages by campaignType.
   */
  getActiveSpinPackagesByCampaignType: initDataProtectedProcedure
    .input(
      z.object({
        campaignType: z.enum(campaignTypes.enumValues),
      })
    )
    .query(async ({ input }) => {
      const { campaignType } = input;
      return tokenCampaignSpinPackagesDB.getActiveSpinPackagesByCampaignType(campaignType);
    }),

  spinForNft: initDataProtectedProcedure
    .input(
      z.object({
        campaignType: z.enum(campaignTypes.enumValues),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { campaignType } = input;
      const userId = ctx.user?.user_id;
      const { allowed } = await checkRateLimit(userId.toString(), "spinForNftCampaign", 30, 60);
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "CAMPAIGN_LOG:Router:addOrder: Rate limit exceeded. Try again later.",
        });
      }

      return await db.transaction(async (tx) => {
        // 1) Find an existing *unused* spin row
        const spinRow = await tokenCampaignUserSpinsDB.getUnusedSpinForUserTx(tx, userId);
        if (!spinRow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No unused spin found for userId ${userId}.`,
          });
        }

        // 2) Fetch eligible collections for the campaign
        const allCollections = await tokenCampaignNftCollectionsDB.getCollectionsByCampaignType(campaignType);
        const itemsWithWeight = allCollections.map((c) => ({
          ...c,
          weight: c.probabilityWeight,
        }));

        // 3) Weighted random pick
        const selectedCollection = secureWeightedRandom(itemsWithWeight);
        if (!selectedCollection) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `CAMPAIGN_LOG:Router: No collection found for campaign type ${campaignType}.`,
          });
        }
        // 4) Assign the chosen collection to the spin row
        await tokenCampaignUserSpinsDB.updateUserSpinByIdTx(tx, spinRow.id, {
          nftCollectionId: selectedCollection.id,
        });
        logger.log(`Assigned collection ${selectedCollection.id} to spin row ${spinRow.id}`);
        // 5) Increment salesCount (and optionally salesVolume) for this collection
        await tokenCampaignNftCollectionsDB.incrementCollectionSalesTx(tx, selectedCollection.id);
        logger.log(`Incremented salesCount for collection ${selectedCollection.id} by 1`);
        // 6) Return the chosen collection
        // convert selectedCollection to secure type
        const selectedCollectionSecure = {
          ...selectedCollection,
          // Add any additional properties you want to secure
          itemsWithWeight: undefined,
          probabilityWeight: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          address: undefined,
        };
        return selectedCollectionSecure;
      });
    }),

  /**
   * 1) Add a new order (must be logged in).
   */
  addOrder: initDataProtectedProcedure
    .input(
      z.object({
        spinPackageId: z.number(),
        // walletAddress: z.string().optional().default(""),
        walletAddress: z.string().refine((data) => Address.isAddress(Address.parse(data))),
        affiliateHash: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Ensure the user is logged in (ctx.user set by your auth)
      const userId = ctx.user?.user_id;
      const { allowed } = await checkRateLimit(userId.toString(), "addOrderCampaign", 30, 60);
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "CAMPAIGN_LOG:Router:addOrder: Rate limit exceeded. Try again later.",
        });
      }
      const eligibility = await userEligibilityDB.isUserEligible(userId);
      if (!eligibility) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `CAMPAIGN_LOG:Router: User ${userId} is not eligible for this campaign.`,
        });
      }

      const { spinPackageId, walletAddress } = input;
      const spinPackage = await tokenCampaignSpinPackagesDB.getSpinPackageById(spinPackageId);
      if (!spinPackage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `CAMPAIGN_LOG:Router: Spin package with ID ${spinPackageId} not found.`,
        });
      }
      // Check user must not be the affiliator of affiliateHash
      let affiliateHash = null;
      if (input?.affiliateHash) {
        const AffiliateLinkData = await affiliateLinksDB.getAffiliateLinkByHash(input.affiliateHash);
        if (!AffiliateLinkData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `CAMPAIGN_LOG:Router: Affiliate link with hash ${input.affiliateHash} not found. for userId ${userId}`,
          });
        }
        if (AffiliateLinkData.affiliatorUserId !== userId) {
          affiliateHash = input.affiliateHash;
        } else {
          logger.error(`CAMPAIGN_LOG:Router: User ${userId} is the owner of the affiliate link ${input.affiliateHash}`);
        }
      }
      // Build the TokenCampaignOrdersInsert object
      // (some columns have defaults in DB, e.g. status="new")
      const orderData: TokenCampaignOrdersInsert = {
        userId,
        spinPackageId,
        finalPrice: spinPackage.price.toString(),
        defaultPrice: spinPackage.price.toString(),
        wallet_address: walletAddress,
        status: "new" as TokenCampaignOrdersStatus,
        currency: spinPackage.currency,
        affiliateHash: affiliateHash ?? null,
      };

      // Insert into the DB
      const order = await tokenCampaignOrdersDB.addOrder(orderData);

      if (!order) {
        logger.error(`CAMPAIGN_LOG:Router: Failed to create order for userId ${userId}:`, orderData, order);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `CAMPAIGN_LOG:Router: Failed to create order.  for userId ${userId}`,
        });
      }
      logger.info(`CAMPAIGN_LOG:Router: Order created for userId ${userId}:`, order);
      return order;
    }),

  /**
   * 2) Get a single order by its numeric ID.
   */
  getOrder: initDataProtectedProcedure
    .input(
      z.object({
        orderId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.user_id;

      const { orderId } = input;

      // Fetch from the DB
      const order = await tokenCampaignOrdersDB.getOrderById(orderId);
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `CAMPAIGN_LOG:Router: Order with ID ${orderId} not found. for userId ${userId}`,
        });
      }

      // Optional: check if order.userId matches current userId
      if (order.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `CAMPAIGN_LOG:Router: Order with ID ${orderId} does not belong to the current user. for userId ${userId}`,
        });
      }

      return order;
    }),
  /**
   * 3) Get all collections with count for a given user ID.
   */
  getUserCollectionsResult: initDataProtectedProcedure
    .input(
      z.object({
        campaignType: z.enum(campaignTypes.enumValues),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.user_id;

      // If you only want certain campaign, pass input.campaignType
      const result = await tokenCampaignUserSpinsDB.getAllCollectionsWithUserCount(userId, input.campaignType);
      return result;
    }),

  /**
   * 4) Get how many spins a user has used vs. remaining.
   * Optionally filter by a specific spinPackageId.
   */
  getUserSpinStats: initDataProtectedProcedure
    .input(
      z.object({
        spinPackageId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.user_id;

      const { spinPackageId } = input;

      // Fetch aggregator data from DB
      const stats = await tokenCampaignUserSpinsDB.getUserSpinStats(userId, spinPackageId);
      return stats; // { used, remaining }
    }),
  /**
   * Only allows transitioning an order to "confirming" or "cancel".
   */
  updateOrderStatusConfirmCancel: initDataProtectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["confirming", "cancelled"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.user_id;

      const { orderId, status } = input;
      const order = await tokenCampaignOrdersDB.getOrderById(orderId);
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `CAMPAIGN_LOG:Router:updateOrderStatusConfirmCancel: Order #${orderId} not found. for userId ${userId}`,
        });
      }

      if (order.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `CAMPAIGN_LOG:Router:updateOrderStatusConfirmCancel: You are not the owner of this order. for userId ${userId}`,
        });
      }

      // Only allow switching from "new" or "confirming" to the new status.
      if (!["new", "confirming"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CAMPAIGN_LOG:Router:updateOrderStatusConfirmCancel: Cannot transition from ${order.status} to ${status}. for userId ${userId} and orderId ${orderId}`,
        });
      }

      // Perform the update
      const updated = await tokenCampaignOrdersDB.updateOrderById(orderId, { status });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `CAMPAIGN_LOG:Router:updateOrderStatusConfirmCancel: Failed to update order status. for userId ${userId} and orderId ${orderId}`,
        });
      }

      return updated;
    }),
  /**
   *   Check if a user is eligible for a campaign.
   */
  checkUserEligible: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.user_id;
    const found = await userEligibilityDB.isUserEligible(userId);
    return { eligible: found };
  }),

  getOnionCampaignAffiliateData: initDataProtectedProcedure.query(async ({ ctx }) => {
    // 1) Check user

    const userId = ctx.user?.user_id;

    // 2) See if there's already a link for onion1-campaign
    let link = await affiliateLinksDB.getAffiliateLinkForOnionCampaign(userId);
    if (!link) {
      // 3) If not, create
      const linkHash = generateRandomHash(8);
      link = await affiliateLinksDB.createOnionCampaignLink(userId, linkHash);
      if (!link) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `CAMPAIGN_LOG:Router:getOnionCampaignAffiliateData: Failed to create affiliate link for userId ${userId}`,
        });
      }
      logger.log(
        `CAMPAIGN_LOG:Router:getOnionCampaignAffiliateData: Created affiliate link for userId ${userId}: ${link.linkHash}`
      );
    }
    //await affiliateClicksDB.enqueueClick(link.linkHash, userId);
    // 4) Sum the spin counts from completed orders with this linkHash
    const totalSpins = await tokenCampaignOrdersDB.sumSpinCountByAffiliateHash(link.linkHash);
    const botUserName = process.env.NEXT_PUBLIC_BOT_USERNAME || "theontonbot";
    // 5) Return data
    return {
      linkHash: `https://t.me/${botUserName}/event?startapp=campaign-aff-${link.linkHash}`,
      totalSpins,
    };
  }),

  /**
   * 1) Checks the wallet's TON balance,
   * 2) Fetches all NFT items from the single on-chain collection,
   * 3) Looks up each NFT in your DB to find out its 'itemType' or 'campaignType',
   * 4) Groups them by type and returns them in one response.
   */
  getWalletInfo: initDataProtectedProcedure
    .input(
      z.object({
        walletAddress: z.string().refine((val) => {
          try {
            // Validate that it's a valid TON address
            Address.parse(val);
            return true;
          } catch {
            return false;
          }
        }, "Invalid TON address."),
      })
    )
    .query(async ({ input, ctx }) => {
      type NFTData = Record<string, CampaignNFT[]>;

      const { walletAddress } = input;
      // 1) Optional Rate Limit
      const { allowed } = await checkRateLimit(ctx.user.user_id.toString(), "campaignRouterGetWalletInfo", 10, 60);
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Try again later.",
        });
      }
      try {
        // 1) Fetch TON balance
        const balance = await tonCenter.getAccountBalance(walletAddress);

        const SINGLE_COLLECTION_ADDRESS = is_prod_env()
          ? "EQCCZnimwuTKit3vcUwF7JR26iLu1f6osAXAWtYNS9c-Q-8m"
          : "EQA4SQVjM6bpSiJ7uG-r7kRvbztVXMceCLFsqwQlfzCEvyax";
        // 2) Fetch on-chain NFT items from the single shared collection
        //    => This call returns { nft_items, address_book }
        const chainData = await tonCenter.fetchNFTItemsWithRetry(walletAddress, SINGLE_COLLECTION_ADDRESS);
        const onChainNftItems: NFTItem[] = chainData?.nft_items ?? [];

        if (!onChainNftItems.length) {
          // No items found on-chain, just return
          return {
            address: walletAddress,
            balance,
            itemsByType: {} as NFTData,
            platinumCount: null,
          };
        }

        // Collect all the on-chain addresses for these NFTs
        const nftAddresses = onChainNftItems.map((item) => item.address);

        // 3) Look up each NFT in your local DB to determine item type
        const dbRows = await tokenCampaignNftItemsDB.getItemsByAddresses(nftAddresses);
        // dbRows => Array of { nftItem: TokenCampaignNftItems, collection: TokenCampaignNftCollections }

        // 4) Group them by itemType or campaignType
        //    e.g. { gold: [...], silver: [...], bronze: [...] }
        const grouped: NFTData = {};

        for (const row of dbRows) {
          const { nftItem, collection } = row;
          const typeKey = collection.id.toString() || collection.id.toString(); // Use collection name or ID as the key

          if (!grouped[typeKey]) {
            grouped[typeKey] = [];
          }

          // You can merge on-chain data + DB data
          // or store them separately, e.g.:
          // Find the original onChain item to get metadata (uri, index, etc.)
          const chainItem = onChainNftItems.find((c) => c.address === nftItem.nftAddress);

          const item = {
            onChain: chainItem,
            offChain: nftItem,
            collectionInfo: collection,
          };
          grouped[typeKey].push(item);
        }
        // ➜ 3a) **Extra query** – how many *platinum* NFTs does this wallet have?
        logger.log(`check user platinum count for ${walletAddress} with nft addresses`, nftAddresses);
        const platinumCount = await tokenCampaignNftItemsDB.countPlatinumByAddresses(nftAddresses);
        return {
          address: walletAddress,
          balance,
          itemsByType: grouped,
          platinumCount,
        };
      } catch (error) {
        logger.error("Error fetching wallet info:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch wallet info.",
        });
      }
    }),

  addTransaction: initDataProtectedProcedure
    .input(
      z.object({
        orderId: z.number().optional(),
        walletAddress: z.string(),
        finalPrice: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await tokenCampaignMergeTransactionsDB.createTransactionRecord(
        input.orderId,
        input.walletAddress,
        input.finalPrice
      );
      logger.info(`[addTransaction] Inserted row #${result.id} for wallet ${result.walletAddress}`);
      return result;
    }),

  addMergeTransaction: initDataProtectedProcedure
    .input(
      z.object({
        walletAddress: z.string().refine((val) => {
          try {
            Address.parse(val);
            return true;
          } catch {
            return false;
          }
        }, "Invalid TON address."),
        goldNftAddress: z.string().nonempty(),
        silverNftAddress: z.string().nonempty(),
        bronzeNftAddress: z.string().nonempty(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await tokenCampaignMergeTransactionsDB.createMergeTransactionRecord(
        input.walletAddress,
        input.goldNftAddress,
        input.silverNftAddress,
        input.bronzeNftAddress,
        ctx.user.user_id
      );
      logger.info(`[addMergeTransaction] Inserted merge row #${result.id}, status=${result.status}`);
      return result;
    }),

  getUserMergeTransactions: initDataProtectedProcedure
    .input(
      z.object({
        walletAddress: z.string().refine((val) => {
          try {
            Address.parse(val);
            return true;
          } catch {
            return false;
          }
        }, "Invalid TON address."),
      })
    )
    .query(async ({ input }) => {
      const merges = await tokenCampaignMergeTransactionsDB.getMergeTransactionsByWallet(input.walletAddress);
      return merges;
    }),

  getClaimOverview: walletJWTProtectedProcedure
    .input(
      z.object({
        walletAddress: z.string().refine((v) => {
          try {
            Address.parse(v);
            return true;
          } catch {
            return false;
          }
        }, "Invalid TON address"),
      })
    )
    .query(async ({ input, ctx }) => {
      /* ✅ token ↔ requested wallet must match */
      logger.log(
        `ONION_CLAIM: getClaimOverview1: tokenAddr=${ctx.jwt.address}, reqAddr=${input.walletAddress} for userId=${ctx.user.user_id}`
      );
      const tokenAddr = Address.parse(ctx.jwt.address).toString({ bounceable: false });
      const reqAddr = Address.parse(input.walletAddress).toString({ bounceable: false });

      if (tokenAddr !== reqAddr) {
        logger.error(
          `ONION_CLAIM: getClaimOverview1: tokenAddr=${tokenAddr}, reqAddr=${reqAddr} for userId=${ctx.user.user_id}`
        );
        throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "token / wallet mismatch" });
      }
      logger.log(
        `ONION_CLAIM: getClaimOverview2: tokenAddr=${tokenAddr}, reqAddr=${reqAddr} for userId=${ctx.user.user_id}`
      );
      /* business logic … */
      return buildClaimOverview(ctx.user.user_id, input.walletAddress);
    }),

  claimOnion: walletJWTProtectedProcedure
    .input(
      z.object({
        walletAddress: z.string().refine((v) => {
          try {
            Address.parse(v);
            return true;
          } catch {
            return false;
          }
        }, "Invalid TON address"),
        tonProof: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.jwt.address !== input.walletAddress) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "wallet in JWT ≠ wallet in request",
        });
      }
      const userId = ctx.user.user_id;
      const wallet = input.walletAddress;
      //verifyTonProof(input.tonProof, input.walletAddress, ctx.user.user_id);
      /* 1. Reject if wallet already claimed */
      if (await tokenCampaignClaimOnionDB.walletAlreadyClaimed(wallet)) {
        throw new TRPCError({ code: "CONFLICT", message: "Wallet already claimed." });
      }

      /* 2. Does user already have a primary? */
      const previousClaims = await tokenCampaignClaimOnionDB.fetchClaimsByUser(userId);
      const hasPrimary = previousClaims.some((r) => r.walletType === "primary");

      /* 3. Get the breakdown for the CONNECTED wallet only */
      const overview = await buildClaimOverview(userId, wallet);
      const thisWalletBreakdown = overview.find((w) => w.walletAddress === wallet);

      if (!thisWalletBreakdown || thisWalletBreakdown.claimStatus === "claimed") {
        logger.error(
          `ONION_CLAIM: No breakdown for wallet ${wallet} for userId ${userId} => overview:`,
          overview,
          thisWalletBreakdown
        );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nothing to claim for this wallet.",
        });
      }

      /* 4. Assemble insert payload */
      const b = thisWalletBreakdown;
      const insertRow: TokenCampaignClaimOnionInsert = {
        userId,
        walletAddress: wallet,
        walletType: hasPrimary ? "secondary" : "primary",
        tonProof: input.tonProof ?? null,
        snapshotRuntime: SNAPSHOT_DATE,

        /* NFT data */
        platinumNftCount: b.nft.counts.platinum,
        goldNftCount: b.nft.counts.gold,
        silverNftCount: b.nft.counts.silver,
        bronzeNftCount: b.nft.counts.bronze,

        onionsFromPlatinum: b.nft.onions.platinum.toString(),
        onionsFromGold: b.nft.onions.gold.toString(),
        onionsFromSilver: b.nft.onions.silver.toString(),
        onionsFromBronze: b.nft.onions.bronze.toString(),

        /* Score onions: ZERO on secondaries */
        onionsFromScore: hasPrimary ? "0" : b.scoreOnions.toString(),

        totalOnions: hasPrimary ? b.nft.totalOnions.toString() : (b.nft.totalOnions + b.scoreOnions).toString(),
      };

      /* 5. Atomic transaction */
      const [claimRow] = await db.transaction(async (tx) => {
        /* mark snapshots only when first (primary) claim */
        if (!hasPrimary) {
          await markScoreRowsClaimedTx(tx, userId);
        }
        await markNftRowsClaimedTx(tx, wallet);

        return await insertClaimRowTx(tx, insertRow);
      });

      return { success: true, claim: claimRow };
    }),
});
