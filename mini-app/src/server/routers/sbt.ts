import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { sbtService } from "@/services/sbtService";
import { sbtDB } from "@/db/modules/sbt.db";
import ticketDB from "@/db/modules/ticket.db";
import { usersDB } from "@/db/modules/users.db";
import eventDB from "@/db/modules/events.db";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";
import { logger } from "../utils/logger";
import { TRPCError } from "@trpc/server";
import { is_mainnet } from "@/services/tonCenter";

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

  getUserBadges: publicProcedure
    .input(z.object({ userId: z.number() }))
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
      }));

      // Collect native event UUIDs to deduplicate against legacy rows
      const nativeEventUuids = new Set(
        nativeRows.map((r) => r.collection.eventUuid).filter(Boolean)
      );

      // Fetch historical TON Society badges
      let legacyBadges: UnifiedBadge[] = [];
      try {
        const legacyRows = await rewardDB.findUserClaimedTonSocietyBadges(input.userId);
        legacyBadges = legacyRows
          .filter((r) => !nativeEventUuids.has(r.eventUuid))
          .map((r) => {
            const data = (r.rewardData as { reward_link?: string; sbt_address?: string } | null) || {};
            const sbtAddress = data.sbt_address || null;
            const rewardLink = data.reward_link || null;
            const explorerUrl = sbtAddress
              ? `https://tonviewer.com/${sbtAddress}`
              : (rewardLink || "https://society.ton.org");

            const badgeTitle = r.eventTitle ? `${r.eventTitle} Badge` : "TON Society Attendance Badge";
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
              status: "minted",
              transactionHash: null,
              createdAt: r.createdAt,
              explorerUrl,
              collectionName: "TON Society",
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
              issuer: "TON Society",
              network: "TON Mainnet",
              rewardLink,
            };
          });
      } catch (err) {
        logger.error(`getUserBadges: Failed to fetch legacy TON Society badges for user ${input.userId}`, err);
      }

      // Merge and sort badges descending by date
      const allBadges = [...nativeBadges, ...legacyBadges].sort((a, b) => {
        const timeA = a.eventDateFrom ? a.eventDateFrom.getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.eventDateFrom ? b.eventDateFrom.getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      return {
        badges: allBadges,
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

  mintBadge: publicProcedure
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
    .mutation(async ({ input }) => {
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

  claimAttendanceSbt: publicProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
        walletAddress: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Get ticket
      const ticket = await ticketDB.getTicketByUuid(input.ticketUuid);
      if (!ticket || !ticket.event_uuid || !ticket.user_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      }

      // 2. Ensure ticket is checked in
      if (ticket.status !== "USED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket must be checked in before claiming SBT badge" });
      }

      // 3. Update user wallet address
      try {
        await usersDB.updateWallet(ticket.user_id, input.walletAddress, "system_sbt_claim");
      } catch (err) {
        logger.error(`claimAttendanceSbt: Failed to update wallet for user ${ticket.user_id}`, err);
      }

      // 4. Fetch event details for metadata
      const eventData = await eventDB.fetchEventByUuid(ticket.event_uuid);
      if (!eventData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // 5. Mint SBT badge
      try {
        const item = await sbtService.mintSbtBadge({
          eventUuid: ticket.event_uuid,
          userId: ticket.user_id,
          walletAddress: input.walletAddress,
          badgeTitle: `${eventData.title} Attendance Badge`,
          badgeDescription: `Official Soulbound Proof of Attendance for ${eventData.title}`,
          badgeImage: eventData.tsRewardImage || eventData.image_url || undefined,
        });

        // 6. Record visitor check-in
        await visitorsDB.addVisitor(ticket.user_id, ticket.event_uuid);

        return {
          success: true,
          itemAddress: item.itemAddress,
          rewardLink: getExplorerLink(item.itemAddress),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to mint SBT badge";
        logger.error(`claimAttendanceSbt: Error minting SBT badge: ${message}`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
