import { JoinOntonAffiliateScore, ScoreItem, userScoreDb } from "@/db/modules/userScore.db";
import { userScoreItem, usersScoreActivity, UsersScoreActivityType } from "@/db/schema/usersScore";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { initDataProtectedProcedure, router } from "../trpc";

import { handleSingleRewardUpdate } from "@/cronJobs/helper/handleSingleRewardUpdate";
import { RewardType } from "@/db/enum";
import eventDB from "@/db/modules/events.db";
import visitorsDB from "@/db/modules/visitors.db";
import { RewardTonSocietyStatusType } from "@/db/schema/rewards";
import { logger } from "@/server/utils/logger";

export type GetEventSBTUserScoreResult = {
  success: boolean;
  tonSocietyStatus: RewardTonSocietyStatusType | null; // true if the event is integrated with Ton Society
  userPoint: number; // The user's total or newly updated points
  visitorId: number | null; // The visitor ID we processed
};

const getEventsWithClaimAndScoreInfiniteInput = z.object({
  activityType: z.enum(usersScoreActivity.enumValues),
  limit: z.number().min(1).max(50).default(10),
  cursor: z.number().min(0).default(0),
  // 'cursor' represents the offset in an offset-based pagination approach.
});
export const UsersScoreRouter = router({
  /**
   * Get the total score for a given user.
   */
  getTotalScoreByUserId: initDataProtectedProcedure.query(async (opts) => {
    try {
      const totalScore = await userScoreDb.getTotalScoreByUserId(opts.ctx.user.user_id);
      return totalScore || 0;
    } catch (error) {
      logger.error(`Error retrieving total score for user id: ${opts.ctx.user.user_id}`, error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error retrieving total score for user id: ${opts.ctx.user.user_id}`,
      });
    }
  }),

  /**
   * Get the total score for a given user filtered by a specific activity type.
   */
  getTotalScoreByActivityTypesAndUserId: initDataProtectedProcedure
    .input(
      z.object({
        // ⬇️  **array** (at least one) instead of a single enum value
        activityTypes: z.array(z.enum(usersScoreActivity.enumValues)).min(1, "At least one activity type is required"),

        itemType: z.enum(userScoreItem.enumValues),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      try {
        return await userScoreDb.getTotalScoreByActivityTypesAndUserId(user.user_id, input.activityTypes, input.itemType);
      } catch (error) {
        logger.error(
          `Error retrieving total score for user ${user.user_id}, ` +
            `activityTypes=[${input.activityTypes.join(",")}], ` +
            `itemType=${input.itemType}`,
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to retrieve total score for the requested activity types",
        });
      }
    }),

  getScoreDetail: initDataProtectedProcedure.input(getEventsWithClaimAndScoreInfiniteInput).query(async ({ ctx, input }) => {
    const { activityType, limit, cursor } = input;
    const eventActivityTypes: UsersScoreActivityType[] = [
      "paid_online_event",
      "paid_offline_event",
      "free_online_event",
      "free_offline_event",
    ];
    const joinOntonActivityTypes: UsersScoreActivityType[] = ["join_onton_affiliate"];
    if (activityType && eventActivityTypes.includes(activityType)) {
      try {
        // 1) Destructure and compute flags

        const currentTimeSec = Math.floor(Date.now() / 1000);

        let isPaid = false;
        let isOnline = false;
        let pointsCouldBeClaimed = 0;

        switch (activityType) {
          case "paid_online_event":
            isPaid = true;
            isOnline = true;
            pointsCouldBeClaimed = 10;
            break;
          case "paid_offline_event":
            isPaid = true;
            pointsCouldBeClaimed = 20;
            break;
          case "free_online_event":
            isOnline = true;
            pointsCouldBeClaimed = 1;
            break;
          case "free_offline_event":
            pointsCouldBeClaimed = 10;
            break;
        }

        logger.log(
          `getEventsWithClaimAndScoreInfinite: userId=${ctx.user.user_id}, activityType=${activityType}, ` +
            `isPaid=${isPaid}, isOnline=${isOnline}, pointsCouldBeClaimed=${pointsCouldBeClaimed}, ` +
            `limit=${limit}, cursor=${cursor}`
        );

        // 2) Fetch data with offset and limit
        const data = await userScoreDb.getEventsWithClaimAndScoreDBPaginated(
          ctx.user.user_id,
          // 5705832807,
          activityType,
          isPaid,
          isOnline,
          pointsCouldBeClaimed,
          currentTimeSec,
          limit,
          cursor
        );

        // 3) Determine the nextCursor (if there are more records beyond this batch)
        // If data.length < limit => we've likely hit the end, so no next cursor
        let nextCursor: number | null = null;
        if (data.length === limit) {
          // The next offset after this batch
          nextCursor = cursor + limit;
        }

        return {
          items: data as ScoreItem[],
          nextCursor,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error getting paginated events with claim & score for user: ${ctx.user.user_id}`,
          cause: error,
        });
      }
    } else if (activityType && joinOntonActivityTypes.includes(activityType)) {
      try {
        const rows = await userScoreDb.getUserScoresForJoinOntonAffiliatePaginated(ctx.user.user_id, limit, cursor);

        const items: JoinOntonAffiliateScore[] = rows.map((r) => ({
          id: Number(r.id),
          point: Number(r.point),
          itemId: Number(r.itemId),
          createdAt: r?.createdAt?.toString() ?? null,
          userId: Number(r.userId),
          userName: r.userName,
          userFirstName: r.userFirstName,
          userLastName: r.userLastName,
          userPhotoUrl: r.userPhotoUrl,
        }));

        const nextCursor = rows.length === limit ? cursor + limit : null;

        return { items: items as ScoreItem[], nextCursor };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error paginating join_onton_affiliate scores for user ${ctx.user.user_id}`,
          cause: err,
        });
      }
    }
  }),

  checkEventPoints: initDataProtectedProcedure
    .input(
      z.object({
        eventId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<GetEventSBTUserScoreResult> => {
      const userId = ctx.user.user_id;
      const eventId = input.eventId;

      /* Fetch the event */
      const eventRow = await eventDB.fetchEventById(eventId);
      if (!eventRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Event with id=${eventId} not found`,
        });
      }

      /* Activity-ID must exist (event integrated with Ton Society) */
      const activityId = eventRow.activity_id;
      if (!activityId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This event is not eligible for Ton Society rewards",
        });
      }

      /* There must be a visitor row for this user and event */
      const visitor = await visitorsDB.findVisitorByUserAndEvent(userId, eventRow.event_uuid);
      if (!visitor) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You need to claim your SBT first",
        });
      }

      /* Sync with Ton Society and maybe insert a user score */
      const rewardResult = await handleSingleRewardUpdate(activityId, visitor.id, eventId, "ton_society_sbt" as RewardType);

      if (!rewardResult.success) {
        // If Ton Society says NOT_ELIGIBLE, treat as forbidden; otherwise server error
        const baseCode = rewardResult.tonSocietyStatus === "NOT_ELIGIBLE" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR";

        throw new TRPCError({
          code: baseCode,
          message: rewardResult.error ?? "Unable to update reward status",
        });
      }

      /* Success → return points just granted (or 0 if already had them) */
      return {
        success: true,
        tonSocietyStatus: rewardResult.tonSocietyStatus,
        userPoint: rewardResult.userScore?.user_point ?? 0,
        visitorId: visitor.id,
      };
    }),
});
