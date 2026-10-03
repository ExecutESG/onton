import {
  eventManagementProtectedProcedure,
  initDataProtectedProcedure,
  router,
} from "../trpc";
import { z } from "zod";
import ticketDB from "@/db/modules/ticket.db";
import { TRPCError } from "@trpc/server";
import { logger } from "../utils/logger";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";
import eventDB from "@/db/modules/events.db";
import { usersDB } from "@/db/modules/users.db";
import { sbtService } from "@/services/sbtService";
import { generatePassToken, verifyPassToken, isDynamicToken } from "@/lib/totp/passToken";

// Type guard to check if result is alreadyCheckedIn type
function isAlreadyCheckedIn(result: unknown): result is { alreadyCheckedIn: boolean } {
  return typeof result === "object" && result !== null && "alreadyCheckedIn" in result;
}

/** Throws unless the ticket exists and belongs to the given event. */
async function getTicketForEventOrThrow(ticketUuid: string, eventUuid: string) {
  const ticket = await ticketDB.getTicketByUuid(ticketUuid);
  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
  }
  if (ticket.event_uuid !== eventUuid) {
    throw new TRPCError({ code: "CONFLICT", message: "This ticket belongs to a different event" });
  }
  return ticket;
}

export const ticketRouter = router({
  /** Scan step: event managers resolve a live rotating pass token. Static UUIDs are rejected. */
  getTicketByUuid: eventManagementProtectedProcedure
    .input(
      z.object({
        event_uuid: z.string().uuid(),
        ticketUuid: z.string(),
      })
    )
    .query(async (opts) => {
      const verification = verifyPassToken(opts.input.ticketUuid);
      if (!verification.valid || !verification.uuid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: verification.message || "Invalid or expired ticket pass QR code",
        });
      }

      return getTicketForEventOrThrow(verification.uuid, opts.input.event_uuid);
    }),

  /** Rotating pass token. Only the ticket owner can get it. */
  getTicketQrToken: initDataProtectedProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
      })
    )
    .query(async (opts) => {
      const ticket = await ticketDB.getTicketByUuid(opts.input.ticketUuid);
      if (!ticket || ticket.user_id !== opts.ctx.user.user_id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }
      return generatePassToken(opts.input.ticketUuid);
    }),

  /**
   * Check-in by an event manager. Accepts a live pass token, or the order UUID
   * already resolved by the scan step (the caller is an authorized manager).
   */
  checkInTicket: eventManagementProtectedProcedure
    .input(
      z.object({
        event_uuid: z.string().uuid(),
        ticketUuid: z.string(),
      })
    )
    .mutation(async (opts) => {
      let resolvedTicketUuid = opts.input.ticketUuid.trim();
      if (isDynamicToken(resolvedTicketUuid)) {
        const verification = verifyPassToken(resolvedTicketUuid);
        if (!verification.valid || !verification.uuid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: verification.message || "Invalid or expired ticket pass QR code",
          });
        }
        resolvedTicketUuid = verification.uuid;
      }

      await getTicketForEventOrThrow(resolvedTicketUuid, opts.input.event_uuid);
      const result = await ticketDB.checkInTicket(resolvedTicketUuid);

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check in the ticket",
        });
      }

      const ticketData = await ticketDB.getTicketByUuid(resolvedTicketUuid);

      if (ticketData && ticketData?.user_id && ticketData?.event_uuid) {
        // Create a reward for the user
        const userId = ticketData.user_id;
        const visitor = await visitorsDB.addVisitor(userId, ticketData.event_uuid);

        if (!visitor) {
          logger.error(`Visitor ${userId} not found for event ${ticketData.event_uuid} in handleNotificationReply`);
          throw new Error(`Visitor ${userId} not found`);
        }

        const eventData = await eventDB.fetchEventByUuid(ticketData.event_uuid);
        if (!eventData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Event not found",
          });
        }

        const user = await usersDB.selectUserById(userId);
        let sbtStatus: "pending_creation" | "created" = "pending_creation";
        let rewardLink: string | null = null;
        let sbtAddress: string | null = null;

        if (user?.wallet_address) {
          try {
            const mintedItem = await sbtService.mintSbtBadge({
              eventUuid: ticketData.event_uuid,
              userId,
              walletAddress: user.wallet_address,
              badgeTitle: `${eventData.title} Attendance Badge`,
              badgeDescription: `Official Soulbound Proof of Attendance for ${eventData.title}`,
              badgeImage: eventData.tsRewardImage || eventData.image_url || undefined,
            });
            sbtAddress = mintedItem.itemAddress;
            rewardLink = `https://tonviewer.com/${mintedItem.itemAddress}`;
            sbtStatus = "created";
          } catch (mintErr) {
            logger.error(`CHECKIN::SBT::Auto-mint failed for user ${userId}`, mintErr);
          }
        }

        const existingReward = await rewardDB.checkExistingRewardWithType(visitor?.id, "ton_society_sbt");
        if (!existingReward) {
          const reward = await rewardDB.insertRewardRow(
            visitor.id,
            rewardLink ? { reward_link: rewardLink, sbt_address: sbtAddress } : null,
            userId,
            "ton_society_sbt",
            sbtStatus,
            eventData
          );
          logger.log(
            `CHECKIN::SBT::Reward::Created user reward for user ${userId} and event uuid ${ticketData.event_uuid} with reward ID ${reward.id} (status: ${sbtStatus})`,
            reward
          );
        } else if (existingReward && sbtStatus === "created" && rewardLink) {
          await rewardDB.updateReward(existingReward.id, {
            reward_link: rewardLink,
            sbt_address: sbtAddress,
            status: "created",
          } as any);
        }

        if (isAlreadyCheckedIn(result)) {
          return { alreadyCheckedIn: true, result: result };
        }

        return {
          checkInSuccess: true,
          result: result,
          rewardResult: "success",
          sbtStatus,
          sbtAddress,
          rewardLink,
        };
      }
    }),
});
