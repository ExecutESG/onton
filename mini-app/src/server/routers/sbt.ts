import { z } from "zod";
import { Address } from "@ton/core";
import { adminOrganizerProtectedProcedure, initDataProtectedProcedure, publicProcedure, router } from "../trpc";
import { sbtService } from "@/services/sbtService";
import { sbtDB } from "@/db/modules/sbt.db";
import ticketDB from "@/db/modules/ticket.db";
import { usersDB } from "@/db/modules/users.db";
import eventDB from "@/db/modules/events.db";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";
import { legacyAttendanceDB } from "@/db/modules/legacyAttendance.db";
import { logger } from "../utils/logger";
import { TRPCError } from "@trpc/server";
import tonCenter, { is_mainnet, OrderTransaction } from "@/services/tonCenter";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { sbtItems } from "@/db/schema/sbtItems";
import { and, asc, eq } from "drizzle-orm";
import { CsbtMerkleTree, CsbtLeafData } from "@/lib/csbt";
import { csbtTreeService } from "@/services/csbtTreeService";
import { config } from "@/server/config";
import { is_local_env } from "@/server/utils/evnutils";
import { SBT_ONCHAIN_UPGRADE_PRICE } from "@/constants";

export function getExplorerLink(address: string): string {
  const domain = is_mainnet ? "tonviewer.com" : "testnet.tonviewer.com";
  return `https://${domain}/${address}`;
}

export interface UnifiedBadge {
  id: number | string;
  itemAddress: string | null;
  itemIndex: number;
  metadata: any;
  metadataUrl?: string | null;
  status: string;
  transactionHash?: string | null;
  createdAt: Date | null;
  explorerUrl: string;
  collectionName: string;
  collectionAddress: string | null;
  eventUuid: string;
  eventTitle: string | null;
  eventImage: string | null;
  eventStartDate: number | null;
  eventEndDate: number | null;
  eventDateFrom: Date | null;
  eventDateTo: Date | null;
  eventLocation: string | null;
  eventParticipationType: "in_person" | "online" | null;
  isTonSociety: boolean;
  issuer: string;
  network: string;
  rewardLink: string | null;
  kind?: "native_sbt" | "legacy_onchain" | "legacy_record";
  canUpgrade?: boolean;
  rewardId?: string | null;
}

export const sbtRouter = router({
  getEventCollection: publicProcedure
    .input(z.object({ eventUuid: z.string() }))
    .query(async ({ input }) => {
      const collection = await sbtDB.findCollectionByEventUuid(input.eventUuid);
      return {
        collection,
      };
    }),

  getTreasuryConfig: publicProcedure.query(async () => {
    return {
      treasuryAddress: config?.ONTON_WALLET_ADDRESS || null,
      upgradePriceTon: SBT_ONCHAIN_UPGRADE_PRICE,
    };
  }),

  getUserBadges: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const nativeRows = await sbtDB.findUserSbtItemsWithEvent(input.userId);
      const nativeBadges: UnifiedBadge[] = nativeRows.map((r) => ({
        id: r.item.id,
        itemAddress: r.item.itemAddress as string | null,
        itemIndex: Number(r.item.itemIndex),
        metadata: r.item.metadata,
        metadataUrl: r.item.metadataUrl,
        status: r.item.status,
        transactionHash: r.item.transactionHash,
        createdAt: r.item.createdAt,
        explorerUrl: getExplorerLink(r.item.itemAddress),
        collectionName: r.collection.name,
        collectionAddress: r.collection.collectionAddress,
        eventUuid: r.collection.eventUuid,
        eventTitle: r.eventTitle,
        eventImage: r.eventImage,
        eventStartDate: r.eventStartDate,
        eventEndDate: r.eventEndDate,
        eventDateFrom: r.eventStartDate ? new Date(r.eventStartDate > 1e11 ? r.eventStartDate : r.eventStartDate * 1000) : null,
        eventDateTo: r.eventEndDate ? new Date(r.eventEndDate > 1e11 ? r.eventEndDate : r.eventEndDate * 1000) : null,
        eventLocation: r.eventLocation,
        eventParticipationType: r.eventParticipationType,
        isTonSociety: false,
        issuer: "ONTON Native",
        network: is_mainnet ? "TON Mainnet" : "TON Testnet",
        rewardLink: null,
        kind: "native_sbt",
        canUpgrade: false,
        rewardId: null,
      }));

      // Collect native event UUIDs to deduplicate against legacy rows
      const nativeEventUuids = new Set(
        nativeRows.map((r) => r.collection.eventUuid).filter(Boolean)
      );

      // Fetch all legacy attendance records (all types & statuses, deduplicated per event)
      let legacyBadges: UnifiedBadge[] = [];
      try {
        const legacyResult = await legacyAttendanceDB.findUserLegacyAttendance(input.userId, { limit: 0 });
        legacyBadges = legacyResult.items
          .filter((r) => !nativeEventUuids.has(r.eventUuid))
          .map((r) => {
            const data = (r.rewardData as any) || {};
            const sbtAddress = data.materialized_sbt_address || data.sbt_address || null;
            const explorerUrl = sbtAddress ? `https://tonviewer.com/${sbtAddress}` : (data.reward_link || "");

            const badgeTitle = r.eventTitle ? `${r.eventTitle} Badge` : "Attendance Badge";
            const badgeDesc = r.eventDescription || "Official Soulbound Proof of Attendance for this event.";
            const badgeImg = r.eventRewardImage || r.eventImage || "https://dev-storage.dev.onton.live/ontonimage/approved.lottie";

            return {
              id: `ts_${r.rewardId}`,
              itemAddress: sbtAddress,
              itemIndex: 0,
              metadata: {
                name: badgeTitle,
                description: badgeDesc,
                image: badgeImg,
              },
              metadataUrl: null,
              status: r.kind === "legacy_onchain" ? "minted" : "recorded",
              transactionHash: null,
              createdAt: r.createdAt,
              explorerUrl: explorerUrl,
              collectionName: r.eventTitle || "Attendance Badges",
              collectionAddress: r.sbtCollectionAddress || null,
              eventUuid: r.eventUuid,
              eventTitle: r.eventTitle,
              eventImage: badgeImg,
              eventStartDate: r.eventStartDate,
              eventEndDate: r.eventEndDate,
              eventDateFrom: r.eventStartDate ? new Date(r.eventStartDate > 1e11 ? r.eventStartDate : r.eventStartDate * 1000) : null,
              eventDateTo: r.eventEndDate ? new Date(r.eventEndDate > 1e11 ? r.eventEndDate : r.eventEndDate * 1000) : null,
              eventLocation: r.eventLocation,
              eventParticipationType: r.eventParticipationType,
              isTonSociety: true,
              issuer: "ONTON",
              network: "TON Mainnet",
              rewardLink: data.reward_link || null,
              kind: r.kind,
              canUpgrade: r.kind === "legacy_record",
              rewardId: r.rewardId,
            };
          });
      } catch (err) {
        logger.error(`getUserBadges: Failed to fetch legacy attendance for user ${input.userId}`, err);
      }

      // Merge and sort badges descending by date, with deterministic tie-breaking
      const allBadges = [...nativeBadges, ...legacyBadges].sort((a, b) => {
        const timeA = a.eventDateFrom ? a.eventDateFrom.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.eventDateFrom ? b.eventDateFrom.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        return String(b.id).localeCompare(String(a.id));
      });

      const totalCount = allBadges.length;
      const limit = input.limit ?? 20;
      let startIndex = 0;

      if (input.cursor) {
        let targetId: string | null = null;
        try {
          const decoded = JSON.parse(Buffer.from(input.cursor, "base64").toString("utf-8"));
          targetId = String(decoded.id || decoded);
        } catch {
          targetId = input.cursor;
        }
        const idx = allBadges.findIndex((b) => String(b.id) === targetId);
        if (idx >= 0) {
          startIndex = idx + 1;
        } else {
          // Stale or invalid cursor: halt pagination without infinite looping
          return {
            badges: [],
            nextCursor: null,
            totalCount,
          };
        }
      }

      const paginatedBadges = allBadges.slice(startIndex, startIndex + limit);
      let nextCursor: string | null = null;
      if (startIndex + limit < allBadges.length && paginatedBadges.length > 0) {
        const lastBadge = paginatedBadges[paginatedBadges.length - 1];
        nextCursor = Buffer.from(
          JSON.stringify({
            id: String(lastBadge.id),
            createdAt: lastBadge.createdAt ? new Date(lastBadge.createdAt).toISOString() : null,
          })
        ).toString("base64");
      }

      return {
        badges: paginatedBadges,
        nextCursor,
        totalCount,
      };
    }),

  getWalletBadges: publicProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ input }) => {
      const badges = await sbtDB.findWalletSbtItems(input.walletAddress);
      return {
        badges,
      };
    }),

  verifyOwnership: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        eventUuid: z.string(),
      })
    )
    .query(async ({ input }) => {
      const result = await sbtService.verifySbtOwnership(input.walletAddress, input.eventUuid);
      return result;
    }),

  getAttendeeBadgeStatus: publicProcedure
    .input(
      z.object({
        eventUuid: z.string(),
        userId: z.number().optional(),
        registrantUuid: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let resolvedUserId = input.userId;
      if (!resolvedUserId && input.registrantUuid) {
        const ticket = await ticketDB.getTicketByUuid(input.registrantUuid);
        resolvedUserId = ticket?.user_id || undefined;
      }
      if (!resolvedUserId) {
        return null;
      }

      const item = await sbtDB.findUserSbtForEvent(resolvedUserId, input.eventUuid);
      if (item && item.status === "minted") {
        return {
          status: "minted",
          itemAddress: item.itemAddress,
          rewardLink: getExplorerLink(item.itemAddress),
          item: {
            ...item,
            explorerUrl: getExplorerLink(item.itemAddress),
          },
        };
      }

      // Check fallback reward row
      const visitor = await visitorsDB.findVisitorByUserAndEvent(resolvedUserId, input.eventUuid);
      if (visitor) {
        const rewardRow = await rewardDB.checkExistingRewardWithType(visitor.id, "ton_society_sbt");
        if (rewardRow) {
          const rewardData = rewardRow.data as { reward_link?: string; sbt_address?: string } | null;
          const isMinted = rewardRow.status === "created" || Boolean(rewardData?.reward_link);
          if (isMinted && rewardData?.reward_link) {
            return {
              status: "minted",
              itemAddress: rewardData.sbt_address || null,
              rewardLink: rewardData.reward_link,
              item: null,
            };
          }
        }
      }

      return {
        status: "eligible",
        itemAddress: null,
        rewardLink: null,
        item: null,
      };
    }),

  /** Manual mint from the minter wallet (spends TON). Global admins only. */
  mintBadge: adminOrganizerProtectedProcedure
    .input(
      z.object({
        eventUuid: z.string(),
        userId: z.number().optional(),
        walletAddress: z.string(),
        badgeTitle: z.string().optional(),
        badgeDescription: z.string().optional(),
        badgeImage: z.string().optional(),
        attributes: z
          .array(
            z.object({
              trait_type: z.string(),
              value: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can mint badges manually" });
      }
      try {
        const item = await sbtService.mintSbtBadge(input);
        return {
          success: true,
          item,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to mint SBT badge";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  /** Ticket owner only: claims off-chain Merkle cSBT attendance credential (#1060 Option A) */
  claimAttendanceSbt: initDataProtectedProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
        walletAddress: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Get ticket
      const ticket = await ticketDB.getTicketByUuid(input.ticketUuid);
      if (!ticket || !ticket.event_uuid || !ticket.user_id || ticket.user_id !== ctx.user.user_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      // 2. Ensure ticket is checked in
      if (ticket.status !== "USED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket must be checked in before claiming SBT badge" });
      }

      // 3. Update user wallet address if provided
      if (input.walletAddress) {
        try {
          await usersDB.updateWallet(ticket.user_id, input.walletAddress, "system_sbt_claim");
        } catch (err) {
          logger.error(`claimAttendanceSbt: Failed to update wallet for user ${ticket.user_id}`, err);
        }
      }

      // 4. Fetch event details for metadata
      const eventData = await eventDB.fetchEventByUuid(ticket.event_uuid);
      if (!eventData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // 5. Option A: Free path yields off-chain Merkle cSBT only (no on-chain TEP-85 minting)
      await visitorsDB.addVisitor(ticket.user_id, ticket.event_uuid);

      return {
        success: true,
        kind: "offchain_csbt" as const,
        badgeTitle: `${eventData.title} Attendance Credential`,
        badgeDescription: `Official Soulbound Proof of Attendance for ${eventData.title}`,
        badgeImage: eventData.tsRewardImage || eventData.image_url || "https://onton.app/assets/sbt-badge.png",
        eventUuid: ticket.event_uuid,
        rewardLink: null,
      };
    }),

  getTicketCsbt: publicProcedure
    .input(z.object({ ticketUuid: z.string() }))
    .query(async ({ input }) => {
      const ticket = await ticketDB.getTicketByUuid(input.ticketUuid);
      if (!ticket || !ticket.event_uuid) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      if (ticket.status !== "USED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ticket must be checked in to view attendance credentials",
        });
      }

      const eventData = await eventDB.fetchEventByUuid(ticket.event_uuid);
      if (!eventData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // 1. Check for frozen persisted tree (MinIO)
      const frozen = await csbtTreeService.getFrozenTree(ticket.event_uuid);
      if (frozen) {
        const { record, tree, payload } = frozen;
        const leaves = payload.leaves;

        const targetIndex = leaves.findIndex(
          (l) =>
            (ticket.user_id && l.userId === ticket.user_id) ||
            l.ownerAddress === String(ticket.user_id) ||
            (ticket.telegram && l.ownerAddress === ticket.telegram)
        );

        if (targetIndex === -1) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Attendee credential not found in frozen tree",
          });
        }

        const proof = tree.getProof(targetIndex);
        const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);

        return {
          merkleRootHex: record.root,
          leafIndex: targetIndex,
          leafHashHex: proof.leafHashHex,
          proofStepsCount: proof.steps.length,
          isVerified,
          isFrozen: true,
          anchored: Boolean(record.anchoredAt),
          anchorTxHash: record.anchorTxHash || null,
          badgeName: `${eventData.title} Credential`,
          badgeImageUrl: eventData.tsRewardImage || eventData.image_url || "https://onton.app/assets/sbt-badge.png",
          eventTitle: eventData.title,
          eventUuid: ticket.event_uuid,
          ownerIdentifier: ticket.telegram ? `@${ticket.telegram}` : String(ticket.user_id || "attendee"),
        };
      }

      // 2. Live event: build dynamic tree from checked-in attendees
      const checkedInRegistrants = await db
        .select({
          id: eventRegistrants.id,
          registrantUuid: eventRegistrants.registrant_uuid,
          userId: eventRegistrants.user_id,
        })
        .from(eventRegistrants)
        .where(
          and(
            eq(eventRegistrants.event_uuid, ticket.event_uuid),
            eq(eventRegistrants.status, "checkedin")
          )
        )
        .orderBy(asc(eventRegistrants.id));

      if (checkedInRegistrants.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No checked-in attendees found for this event",
        });
      }

      const targetIndex = checkedInRegistrants.findIndex(
        (r) =>
          r.registrantUuid === ticket.order_uuid ||
          (ticket.user_id && r.userId === ticket.user_id)
      );

      if (targetIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attendee credential not found in live event",
        });
      }

      const leaves: CsbtLeafData[] = checkedInRegistrants.map((reg, idx) => ({
        index: idx,
        ownerAddress: String(reg.userId || 0),
        userId: reg.userId || undefined,
        eventUuid: ticket.event_uuid!,
      }));

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      const proof = tree.getProof(targetIndex);
      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);

      return {
        merkleRootHex: tree.getRootHex(),
        leafIndex: targetIndex,
        leafHashHex: proof.leafHashHex,
        proofStepsCount: proof.steps.length,
        isVerified,
        isFrozen: false,
        anchored: false,
        anchorTxHash: null,
        badgeName: `${eventData.title} Credential`,
        badgeImageUrl: eventData.tsRewardImage || eventData.image_url || "https://onton.app/assets/sbt-badge.png",
        eventTitle: eventData.title,
        eventUuid: ticket.event_uuid,
        ownerIdentifier: ticket.telegram ? `@${ticket.telegram}` : String(ticket.user_id || "attendee"),
      };
    }),

  /** Ticket owner only: this also updates the owner's wallet address. */
  materializeOnChainSbt: initDataProtectedProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
        walletAddress: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Get ticket
      const ticket = await ticketDB.getTicketByUuid(input.ticketUuid);
      if (!ticket || !ticket.event_uuid || !ticket.user_id || ticket.user_id !== ctx.user.user_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      // 2. Ensure ticket is checked in
      if (ticket.status !== "USED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ticket must be checked in before minting on-chain SBT badge",
        });
      }

      // 3. Idempotency: check if user already has an on-chain SBT for this event
      const existingBadge = await sbtDB.findUserSbtForEvent(ticket.user_id, ticket.event_uuid);
      if (existingBadge && existingBadge.status === "minted") {
        return {
          success: true,
          itemAddress: existingBadge.itemAddress,
          explorerUrl: getExplorerLink(existingBadge.itemAddress),
          isExisting: true,
        };
      }

      // 4. Verify 0.1 TON payment to Treasury with memo sbt_upgrade:<ticketUuid>
      const treasuryAddress = config?.ONTON_WALLET_ADDRESS;
      if (!treasuryAddress && !is_local_env()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Treasury wallet not configured",
        });
      }

      let verifiedTx: OrderTransaction | null = null;
      if (treasuryAddress && !is_local_env()) {
        const maxAttempts = 6;
        const delayMs = process.env.NODE_ENV === "test" ? 10 : 2500;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const startUtime = Math.floor((Date.now() - 1800 * 1000) / 1000);
            const transactions = await tonCenter.fetchAllTransactions(treasuryAddress, startUtime, null, 30, "desc");
            const parsed = await tonCenter.parseTransactions(transactions, "sbt_upgrade:");
            const match = parsed.find(
              (tx) => tx.order_uuid === input.ticketUuid && tx.rawAmount >= BigInt(95_000_000)
            );
            if (match) {
              verifiedTx = match;
              break;
            }
          } catch (err) {
            logger.warn(`materializeOnChainSbt: TonCenter lookup attempt ${attempt} failed`, err);
          }

          if (attempt < maxAttempts) {
            await new Promise((res) => setTimeout(res, delayMs));
          }
        }
      }

      if (!verifiedTx && !is_local_env()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment transaction of 0.1 TON not found. Please wait a few seconds for network confirmation.",
        });
      }

      const paymentTxHash: string | undefined =
        verifiedTx?.trx_hash?.trim() || (is_local_env() ? `local_tx_${ticket.id}` : undefined);
      if (!paymentTxHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Valid payment transaction hash is required to materialize on-chain SBT badge",
        });
      }

      const existingByPayment = await db
        .select({ id: sbtItems.id })
        .from(sbtItems)
        .where(eq(sbtItems.paymentTxHash, paymentTxHash))
        .limit(1);
      if (existingByPayment.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This payment transaction has already been used to materialize an SBT badge",
        });
      }

      // 5. Update user wallet address
      try {
        await usersDB.updateWallet(ticket.user_id, input.walletAddress, "system_sbt_upgrade");
      } catch (err) {
        logger.error(`materializeOnChainSbt: Failed to update wallet for user ${ticket.user_id}`, err);
      }

      // 6. Fetch event details for metadata
      const eventData = await eventDB.fetchEventByUuid(ticket.event_uuid);
      if (!eventData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // 7. Mint on-chain SBT badge
      try {
        const item = await sbtService.mintSbtBadge({
          eventUuid: ticket.event_uuid,
          userId: ticket.user_id,
          walletAddress: input.walletAddress,
          badgeTitle: `${eventData.title} Attendance Badge`,
          badgeDescription: `Official Soulbound Proof of Attendance for ${eventData.title}`,
          badgeImage: eventData.tsRewardImage || eventData.image_url || undefined,
          paymentTxHash,
        });

        // 8. Record visitor check-in
        await visitorsDB.addVisitor(ticket.user_id, ticket.event_uuid);

        return {
          success: true,
          itemAddress: item.itemAddress,
          explorerUrl: getExplorerLink(item.itemAddress),
          isExisting: false,
        };
      } catch (error) {
        const isConflict =
          (error as { code?: string })?.code === "23505" ||
          (error as Error)?.message?.includes("sbt_items_payment_tx_hash_uq") ||
          (error as Error)?.message?.includes("duplicate key value");
        if (isConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This payment transaction has already been used to materialize an SBT badge",
          });
        }
        const message = error instanceof Error ? error.message : "Failed to mint SBT badge";
        logger.error(`materializeOnChainSbt: Error minting SBT badge: ${message}`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  /** Attendance record owner only: upgrade legacy attendance record to native on-chain TEP-85 SBT */
  materializeLegacyRecord: initDataProtectedProcedure
    .input(
      z.object({
        rewardId: z.string(),
        walletAddress: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Get reward with visitor details
      const rewardRow = await legacyAttendanceDB.findRewardWithVisitor(input.rewardId);
      if (!rewardRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reward record not found" });
      }

      // 2. Ownership verification: caller must own the record
      if (rewardRow.userId !== ctx.user.user_id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this attendance record",
        });
      }

      // 3. Double minting check / idempotency
      const rewardData = (rewardRow.data as any) || {};
      const existingAddress =
        (rewardData.materialized_sbt_address && String(rewardData.materialized_sbt_address).trim()) ||
        (rewardData.sbt_address && String(rewardData.sbt_address).trim()) ||
        null;
      if (existingAddress) {
        return {
          success: true,
          itemAddress: existingAddress,
          explorerUrl: getExplorerLink(existingAddress),
          isExisting: true,
        };
      }

      const existingBadge = await sbtDB.findUserSbtForEvent(rewardRow.userId, rewardRow.eventUuid);
      if (existingBadge && existingBadge.status === "minted" && existingBadge.itemAddress) {
        await legacyAttendanceDB.updateRewardData(input.rewardId, {
          ...rewardData,
          materialized_sbt_address: existingBadge.itemAddress,
          sbt_address: existingBadge.itemAddress,
        });
        return {
          success: true,
          itemAddress: existingBadge.itemAddress,
          explorerUrl: getExplorerLink(existingBadge.itemAddress),
          isExisting: true,
        };
      }

      // 4. Resolve destination wallet address
      let targetWallet = input.walletAddress;
      if (!targetWallet) {
        const user = await usersDB.selectUserById(ctx.user.user_id);
        targetWallet = user?.wallet_address || undefined;
      }
      if (!targetWallet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Wallet address is required to mint Soulbound credential",
        });
      }

      try {
        Address.parse(targetWallet);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid recipient wallet address: ${targetWallet}`,
        });
      }

      // 5. Verify payment of >= 0.095 TON to treasury wallet with memo sbt_upgrade_legacy:<rewardId>
      const treasuryAddress = config?.ONTON_WALLET_ADDRESS;
      if (!treasuryAddress && !is_local_env()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Treasury wallet not configured",
        });
      }

      let verifiedTx: OrderTransaction | null = null;
      if (treasuryAddress && !is_local_env()) {
        const maxAttempts = 6;
        const delayMs = process.env.NODE_ENV === "test" ? 10 : 2500;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const startUtime = Math.floor((Date.now() - 1800 * 1000) / 1000);
            const transactions = await tonCenter.fetchAllTransactions(treasuryAddress, startUtime, null, 30, "desc");
            const parsed = await tonCenter.parseTransactions(transactions, "sbt_upgrade_legacy:");
            const match = parsed.find(
              (tx) => tx.order_uuid === input.rewardId && tx.rawAmount >= BigInt(95_000_000)
            );
            if (match) {
              verifiedTx = match;
              break;
            }
          } catch (err) {
            logger.warn(`materializeLegacyRecord: TonCenter lookup attempt ${attempt} failed`, err);
          }

          if (attempt < maxAttempts) {
            await new Promise((res) => setTimeout(res, delayMs));
          }
        }
      }

      if (!verifiedTx && !is_local_env()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment transaction of 0.1 TON not found. Please wait a few seconds for network confirmation.",
        });
      }

      const paymentTxHash: string | undefined =
        verifiedTx?.trx_hash?.trim() || (is_local_env() ? `local_tx_${input.rewardId}` : undefined);
      if (!paymentTxHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Valid payment transaction hash is required to materialize on-chain SBT badge",
        });
      }

      const existingByPayment = await db
        .select({ id: sbtItems.id })
        .from(sbtItems)
        .where(eq(sbtItems.paymentTxHash, paymentTxHash))
        .limit(1);
      if (existingByPayment.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This payment transaction has already been used to materialize an SBT badge",
        });
      }

      // 6. Update user wallet address if walletAddress provided
      if (input.walletAddress) {
        try {
          await usersDB.updateWallet(rewardRow.userId, input.walletAddress, "legacy_sbt_upgrade");
        } catch (err) {
          logger.error(`materializeLegacyRecord: Failed to update wallet for user ${rewardRow.userId}`, err);
        }
      }

      // 7. Fetch event details for metadata
      const eventData = await eventDB.fetchEventByUuid(rewardRow.eventUuid);
      if (!eventData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // 8. Mint native TEP-85 SBT
      try {
        const item = await sbtService.mintSbtBadge({
          eventUuid: rewardRow.eventUuid,
          userId: rewardRow.userId,
          walletAddress: targetWallet,
          badgeTitle: `${eventData.title} Attendance Badge`,
          badgeDescription: `Official Soulbound Proof of Attendance for ${eventData.title}`,
          badgeImage: eventData.tsRewardImage || eventData.image_url || undefined,
          paymentTxHash,
        });

        // 9. Store the link in rewards.data
        const updatedRewardData = {
          ...rewardData,
          materialized_sbt_address: item.itemAddress,
          sbt_address: item.itemAddress,
        };
        await legacyAttendanceDB.updateRewardData(input.rewardId, updatedRewardData);

        return {
          success: true,
          itemAddress: item.itemAddress,
          explorerUrl: getExplorerLink(item.itemAddress),
          isExisting: false,
        };
      } catch (error) {
        const isConflict =
          (error as { code?: string })?.code === "23505" ||
          (error as Error)?.message?.includes("sbt_items_payment_tx_hash_uq") ||
          (error as Error)?.message?.includes("duplicate key value");
        if (isConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This payment transaction has already been used to materialize an SBT badge",
          });
        }
        const message = error instanceof Error ? error.message : "Failed to mint SBT badge";
        logger.error(`materializeLegacyRecord: Error minting SBT badge: ${message}`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
