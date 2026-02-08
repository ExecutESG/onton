import { db } from "@/db/db";
import { tokenCampaignNftCollections, tokenCampaignNftItems, tokenCampaignUserSpins } from "@/db/schema";
import { tokenCampaignMergeTransactions } from "@/db/schema/tokenCampaignMergeTransactions";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, or } from "drizzle-orm";

export const createTransactionRecord = async (orderId: number | undefined, walletAddress: string, finalPrice?: number) => {
  // Insert a new row into token_campaign_merge_transactions
  // with status="pending" (for a "payment" type transaction).
  const [inserted] = await db
    .insert(tokenCampaignMergeTransactions)
    .values({
      walletAddress,
      transactionHash: "",
      goldNftAddress: null,
      silverNftAddress: null,
      bronzeNftAddress: null,
      status: "pending",
      extraData: `User pressed pay for order #${orderId}, finalPrice=${finalPrice ?? "N/A"} at ${new Date().toISOString()}`,
    })
    .returning({
      id: tokenCampaignMergeTransactions.id,
      walletAddress: tokenCampaignMergeTransactions.walletAddress,
      status: tokenCampaignMergeTransactions.status,
      createdAt: tokenCampaignMergeTransactions.createdAt,
    });

  return inserted;
};

/**
 * Creates a new merge transaction with {goldNftAddress, silverNftAddress, bronzeNftAddress}.
 *
 * Steps:
 * 1) Rate-limiting: check user hasn't created a new transaction in the last 3 minutes.
 * 2) Verify each NFT is onion1, belongs to the correct collection (1=gold, 2=silver, 3=bronze),
 *    and has mergeStatus="able_to_merge".
 * 3) Check no partial/fully overlapping set is in "pending"/"completed".
 * 4) If exact set is pending => return that row, if completed => throw conflict, if partial => throw conflict.
 * 5) Otherwise, insert a new row => status="pending".
 */
export async function createMergeTransactionRecord(
  walletAddress: string,
  goldNftAddress: string,
  silverNftAddress: string,
  bronzeNftAddress: string,
  user_id: number
) {
  // 1) Rate Limit Check
  // If there's any merge transaction for this wallet created within the last 3 minutes => error
  const threeMinutesAgo = new Date(Date.now() - 3 * 60_000);

  const [recentTx] = await db
    .select({ id: tokenCampaignMergeTransactions.id })
    .from(tokenCampaignMergeTransactions)
    .where(
      and(
        eq(tokenCampaignMergeTransactions.walletAddress, walletAddress),
        gte(tokenCampaignMergeTransactions.createdAt, threeMinutesAgo)
      )
    )
    .limit(1)
    .execute();

  // 2) Verify each NFT individually
  await verifyNftIsCorrectCollection(goldNftAddress, 1, "gold");
  await verifyNftIsCorrectCollection(silverNftAddress, 2, "silver");
  await verifyNftIsCorrectCollection(bronzeNftAddress, 3, "bronze");

  // 3) Query for any row that overlaps ANY of these addresses
  const overlappingRows = await db
    .select()
    .from(tokenCampaignMergeTransactions)
    .where(
      or(
        inArray(tokenCampaignMergeTransactions.goldNftAddress, [goldNftAddress, silverNftAddress, bronzeNftAddress]),
        inArray(tokenCampaignMergeTransactions.silverNftAddress, [goldNftAddress, silverNftAddress, bronzeNftAddress]),
        inArray(tokenCampaignMergeTransactions.bronzeNftAddress, [goldNftAddress, silverNftAddress, bronzeNftAddress])
      )
    )
    .execute();

  function isSameSet(r: (typeof overlappingRows)[number]) {
    return (
      r.goldNftAddress === goldNftAddress &&
      r.silverNftAddress === silverNftAddress &&
      r.bronzeNftAddress === bronzeNftAddress
    );
  }

  // 4) Check overlap logic
  for (const row of overlappingRows) {
    if (isSameSet(row)) {
      // EXACT set match
      if (row.status === "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot re-merge these NFTs. A completed transaction exists for gold=${goldNftAddress}, silver=${silverNftAddress}, bronze=${bronzeNftAddress}.`,
        });
      }
      if (row.status === "pending") {
        // Return existing row (no new insert)
        return {
          id: row.id,
          status: row.status,
        };
      }
      // if row.status is "failed"/"processing", we allow continuing
    } else {
      // PARTIAL overlap
      if (row.status === "pending" || row.status === "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot merge these NFTs. At least one is already used in tx #${row.id} with status=${row.status}.`,
        });
      }
    }
  }
  // No overlaps found, we can insert a new row but we need to check the rate limit
  if (recentTx) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Please wait 3 minutes between merges.",
    });
  }
  // 5) Insert a new row => "pending"
  const [inserted] = await db
    .insert(tokenCampaignMergeTransactions)
    .values({
      walletAddress,
      goldNftAddress,
      silverNftAddress,
      bronzeNftAddress,
      user_id,
      transactionHash: "",
      status: "pending",
      extraData: `User triggered merge at ${new Date().toISOString()}`,
    })
    .returning({
      id: tokenCampaignMergeTransactions.id,
      status: tokenCampaignMergeTransactions.status,
    });

  return inserted;
}

/**
 * Verifies that nftAddress corresponds to an NFT item with:
 *   itemType="onion1",
 *   the correct collection.id = requiredCollectionId,
 *   mergeStatus="able_to_merge".
 * Throws TRPCError if any check fails.
 */
async function verifyNftIsCorrectCollection(
  nftAddress: string,
  requiredCollectionId: number,
  label: "gold" | "silver" | "bronze"
): Promise<void> {
  const rows = await db
    .select({
      itemId: tokenCampaignNftItems.itemId,
      itemType: tokenCampaignNftItems.itemType,
      mergeStatus: tokenCampaignNftItems.mergeStatus,
      collectionId: tokenCampaignNftCollections.id,
    })
    .from(tokenCampaignNftItems)
    .innerJoin(tokenCampaignUserSpins, eq(tokenCampaignUserSpins.id, tokenCampaignNftItems.itemId))
    .innerJoin(tokenCampaignNftCollections, eq(tokenCampaignNftCollections.id, tokenCampaignUserSpins.nftCollectionId))
    .where(eq(tokenCampaignNftItems.nftAddress, nftAddress))
    .execute();

  if (rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `[${label}] NFT address ${nftAddress} not found in DB.`,
    });
  }

  const item = rows[0];

  // itemType check
  if (item.itemType !== "onion1") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `[${label}] NFT ${nftAddress} has itemType=${item.itemType}, expected "onion1".`,
    });
  }

  // collection ID check
  if (item.collectionId !== requiredCollectionId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `[${label}] NFT ${nftAddress} belongs to collection=${item.collectionId}, expected=${requiredCollectionId}.`,
    });
  }

  // mergeStatus check
  if (item.mergeStatus !== "able_to_merge") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `[${label}] NFT ${nftAddress} has mergeStatus=${item.mergeStatus}, expected="able_to_merge".`,
    });
  }
}

export const getMergeTransactionsByWallet = async (walletAddress: string) => {
  // Query merges for this wallet, ordered by createdAt
  const merges = await db
    .select()
    .from(tokenCampaignMergeTransactions)
    .where(eq(tokenCampaignMergeTransactions.walletAddress, walletAddress))
    .orderBy(tokenCampaignMergeTransactions.createdAt)
    .execute();

  return merges;
};

const tokenCampaignMergeTransactionsDB = {
  createTransactionRecord,
  createMergeTransactionRecord,
  getMergeTransactionsByWallet,
};
export default tokenCampaignMergeTransactionsDB;
