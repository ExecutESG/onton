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
      const badges = await sbtDB.findUserSbtItems(input.userId);
      return {
        badges,
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

        // 6. Record/update reward row
        const visitor = await visitorsDB.addVisitor(ticket.user_id, ticket.event_uuid);
        if (visitor) {
          const rewardLink = `https://tonviewer.com/${item.itemAddress}`;
          const existingReward = await rewardDB.checkExistingRewardWithType(visitor.id, "ton_society_sbt");
          if (existingReward) {
            await rewardDB.updateReward(existingReward.id, {
              reward_link: rewardLink,
              sbt_address: item.itemAddress,
              status: "created",
            } as any);
          } else {
            await rewardDB.insertRewardRow(
              visitor.id,
              { reward_link: rewardLink, sbt_address: item.itemAddress },
              ticket.user_id,
              "ton_society_sbt",
              "created",
              eventData
            );
          }
        }

        return {
          success: true,
          itemAddress: item.itemAddress,
          rewardLink: `https://tonviewer.com/${item.itemAddress}`,
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
