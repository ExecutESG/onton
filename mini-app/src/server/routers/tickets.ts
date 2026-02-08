import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import ticketDB from "@/db/modules/ticket.db";
import { TRPCError } from "@trpc/server";
import rewardsService from "@/services/rewardsService";
import { logger } from "../utils/logger";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";
import eventDB from "@/db/modules/events.db";

// Type guard to check if result is alreadyCheckedIn type
function isAlreadyCheckedIn(result: any): result is { alreadyCheckedIn: boolean } {
  return result && "alreadyCheckedIn" in result;
}

export const ticketRouter = router({
  getTicketByUuid: publicProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
      })
    )
    .query(async (opts) => {
      const ticket = await ticketDB.getTicketByUuid(opts.input.ticketUuid);

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      return ticket;
    }),

  checkInTicket: publicProcedure
    .input(
      z.object({
        ticketUuid: z.string(),
      })
    )
    .mutation(async (opts) => {
      const result = await ticketDB.checkInTicket(opts.input.ticketUuid);

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check in the ticket",
        });
      }

      const ticketData = await ticketDB.getTicketByUuid(opts.input.ticketUuid);

      if (ticketData && ticketData?.user_id && ticketData?.event_uuid) {
        // Create a reward for the user
        const userId = ticketData.user_id;
        const visitor = await visitorsDB.addVisitor(userId, ticketData.event_uuid);

        if (!visitor) {
          logger.error(`Visitor ${userId} not found for event ${ticketData.event_uuid} in handleNotificationReply`);
          throw new Error(`Visitor ${userId} not found`);
        }
        const existingReward = await rewardDB.checkExistingRewardWithType(visitor?.id, "ton_society_sbt");
        if (!existingReward) {
          const eventData = await eventDB.fetchEventByUuid(ticketData.event_uuid);
          if (!eventData) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Event not found",
            });
          }
          const reward = await rewardDB.insertRewardRow(
            visitor.id,
            null,
            userId,
            "ton_society_sbt",
            "pending_creation",
            eventData
          );
          logger.log(
            `CHECKIN::SBT::Reward::Created user reward for user ${userId} and event uuid ${ticketData.event_uuid} with reward ID ${reward.id}`,
            reward
          );
        } else {
          logger.log(
            `CHECKIN::SBT::Reward::User reward already exists for user ${userId} and event uuid ${ticketData.event_uuid}`
          );
        }
        if (isAlreadyCheckedIn(result)) {
          return { alreadyCheckedIn: true, result: result };
        }

        return {
          checkInSuccess: true,
          result: result,
          rewardResult: "success",
        };
      }
    }),
});
