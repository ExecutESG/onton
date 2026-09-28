import { db, dbLower } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { users } from "@/db/schema/users";
import { redisTools } from "@/lib/redisTools";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import eventDB from "@/db/modules/events.db";
import rewardDB from "@/db/modules/rewards.db";
import { getUserCacheKey } from "@/db/modules/users.db";
import visitorsDB, { addVisitor } from "@/db/modules/visitors.db";
import telegramService from "@/services/telegramService";
import { sendTelegramMessage } from "@/lib/tgBot";
import { eventManagementProtectedProcedure as evntManagerPP, initDataProtectedProcedure, router } from "@/server/trpc";
import { logger } from "@/server/utils/logger";
import { LinkService } from "@/lib/links/linkService";
import { CombinedEventRegisterSchema } from "@/types";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, like, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

const checkinRegistrantRequest = evntManagerPP
  .input(
    z.object({
      event_uuid: z.string().uuid(),
      registrant_uuid: z.string().uuid(),
    })
  )
  .mutation(async (opts) => {
    const event_uuid = opts.input.event_uuid;
    const event = await eventDB.selectEventByUuid(event_uuid);
    const registrant_uuid = opts.input.registrant_uuid;

    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "event not found" });
    }
    if (!event.has_registration || event.participationType !== "in_person") {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Check-in only for in_person events with registration",
      });
    }

    const lockKey = `lock:checkin:${registrant_uuid}`;
    const acquired = await redisTools.acquireLock(lockKey, 10);
    if (!acquired) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Check-in currently in progress for this attendee. Please try again.",
      });
    }

    try {
      const registrant = (
        await db.select().from(eventRegistrants).where(eq(eventRegistrants.registrant_uuid, registrant_uuid)).execute()
      ).pop();

      if (!registrant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attendee pass not found or invalid",
        });
      }
      if (registrant.event_uuid !== event_uuid) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This attendee pass belongs to a different event",
        });
      }

      if (registrant.status === "checkedin") {
        return { code: 200, message: "Already Checked-in" };
      }
      if (registrant.status !== "approved") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Registrant is not approved for this event",
        });
      }

      const userId = registrant.user_id;
      const visitor = await visitorsDB.addVisitor(userId, event_uuid);

      if (!visitor) {
        logger.error(`Visitor ${userId} not found for event ${event_uuid} in handleNotificationReply`);
        throw new Error(`Visitor ${userId} not found`);
      }
      const existingReward = await rewardDB.checkExistingRewardWithType(visitor?.id, "ton_society_sbt");
      if (!existingReward) {
        const reward = await rewardDB.insertRewardRow(visitor.id, null, userId, "ton_society_sbt", "pending_creation", event);
        logger.log(
          `CHECKIN::SBT::Reward::Created user reward for user ${userId} and event uuid ${event_uuid} with reward ID ${reward.id}`,
          reward
        );
      } else {
        logger.log(`CHECKIN::SBT::Reward::User reward already exists for user ${userId} and event uuid ${event_uuid}`);
      }

      await db
        .update(eventRegistrants)
        .set({
          status: "checkedin",
        })
        .where(eq(eventRegistrants.registrant_uuid, registrant_uuid))
        .execute();

      // Send instant check-in Telegram notification to attendee
      try {
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "notnonstagebot";
        const claimLink = `https://t.me/${botUsername}/event?startapp=${event_uuid}`;
        const hasSbtBadge = Boolean(event.sbt_collection_address);
        const notificationMsg = hasSbtBadge
          ? `🎉 You're Checked In!\n\nWelcome to ${event.title}! You are now eligible to claim your official Soulbound Proof of Attendance badge (SBT).\n\nTap below to connect your TON wallet and claim your badge.`
          : `🎉 You're Checked In!\n\nWelcome to ${event.title}! Your attendance has been successfully confirmed.`;

        await sendTelegramMessage({
          chat_id: userId,
          message: notificationMsg,
          link: hasSbtBadge ? claimLink : undefined,
          linkText: hasSbtBadge ? "Claim SBT Badge 🎖️" : undefined,
        });
      } catch (tgErr) {
        logger.error(`CHECKIN::Notification failed for user ${userId} and event ${event_uuid}`, tgErr);
      }

      const final_message = event.has_payment ? "Reward Link will be sent to user" : "User can claim reward on the event page";
      return { code: 200, message: final_message };
    } finally {
      await redisTools.releaseLock(lockKey);
    }
  });

const processRegistrantRequest = evntManagerPP
  .input(
    z.object({
      event_uuid: z.string(),
      user_id: z.number(),
      status: z.enum(["approved", "rejected"]),
    })
  )
  .mutation(async (opts) => {
    const event_uuid = opts.input.event_uuid;
    const user_id = opts.input.user_id;
    const event = await eventDB.selectEventByUuid(event_uuid);

    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "event not found" });
    }

    const prevStatus = (
      await db
        .select({ status: eventRegistrants.status })
        .from(eventRegistrants)
        .where(and(eq(eventRegistrants.event_uuid, event_uuid), eq(eventRegistrants.user_id, user_id)))
        .execute()
    )[0]?.status;

    const wasApproved = prevStatus === "approved";

    await db
      .update(eventRegistrants)
      .set({
        status: opts.input.status,
      })
      .where(
        and(
          eq(eventRegistrants.event_uuid, event_uuid),
          eq(eventRegistrants.user_id, user_id),
          ne(eventRegistrants.status, "checkedin")
        )
      )
      .execute();

    if (opts.input.status === "approved" || opts.input.status === "rejected") {
      const share_link = LinkService.getEventUrl(event_uuid);

      const approved_message = `✅ Your request has been approved for the event : <b>${event.title}</b> \n${share_link}`;
      const rejected_message = `❌ Your request has been rejected for the event : <b>${event.title}</b> \n${share_link}`;
      const message = opts.input.status === "approved" ? approved_message : rejected_message;

      await telegramService.sendEventPhoto({
        event_id: event.event_uuid,
        user_id: user_id,
        message,
      });

      // Clear the organizer user cache so it will be reloaded next time
      await redisTools.deleteCache(getUserCacheKey(user_id));
    }

    // Auto-promote waitlisted attendee when an approved registration is rejected (#967)
    if (wasApproved && opts.input.status === "rejected") {
      try {
        const approvedCount = await eventRegistrantsDB.getApprovedRequestsCount(event_uuid);
        const capacityAvailable = !event.capacity || approvedCount < event.capacity;

        if (capacityAvailable && !event.has_approval) {
          const [nextWaitlisted] = await db
            .select()
            .from(eventRegistrants)
            .where(
              and(
                eq(eventRegistrants.event_uuid, event_uuid),
                eq(eventRegistrants.status, "pending")
              )
            )
            .orderBy(asc(eventRegistrants.created_at))
            .limit(1)
            .execute();

          if (nextWaitlisted) {
            await db
              .update(eventRegistrants)
              .set({ status: "approved" })
              .where(eq(eventRegistrants.registrant_uuid, nextWaitlisted.registrant_uuid))
              .execute();

            logger.log(
              `[WAITLIST PROMOTION] Auto-promoted attendee ${nextWaitlisted.user_id} for event ${event_uuid}`
            );

            const promoUrl = LinkService.getEventUrl(event_uuid);
            const promoMsg = `🎉 A spot opened up! Your registration has been approved for <b>${event.title}</b>.\n${promoUrl}`;

            await telegramService
              .sendEventPhoto({
                event_id: event.event_uuid,
                user_id: nextWaitlisted.user_id,
                message: promoMsg,
              })
              .catch((err) => {
                logger.warn(`Failed sending waitlist promotion telegram notification to ${nextWaitlisted.user_id}:`, err);
              });

            await redisTools.deleteCache(getUserCacheKey(nextWaitlisted.user_id));
          }
        }
      } catch (promotionErr) {
        logger.error("Waitlist auto-promotion error:", promotionErr);
      }
    }

    return { code: 201, message: "ok" };
  });

const eventRegister = initDataProtectedProcedure.input(CombinedEventRegisterSchema).mutation(async (opts) => {
  const userId = opts.ctx.user.user_id;
  const { event_uuid, ...registerInfo } = opts.input;
  const event = await eventDB.selectEventByUuid(event_uuid);
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: `event not found with uuid ${event_uuid}` });
  }

  if (!event.has_registration) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `event is not registrable with uuid ${event_uuid}`,
    });
  }

  if (event.has_payment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `event has payment buy the ticket with uuid ${event_uuid}`,
    });
  }

  const user_request = await eventRegistrantsDB.getRegistrantRequest(event_uuid, userId);

  if (user_request) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `registrant already has a [${user_request.status}] Request `,
    });
  }

  const lockKey = `lock:event_register:${event_uuid}`;
  const lockAcquired = await redisTools.acquireLock(lockKey, 10);
  if (!lockAcquired) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Server is busy processing registrations for this event. Please try again in a few seconds.",
    });
  }

  try {
    const registrationResult = await db.transaction(async (trx) => {
      let event_filled_and_has_waiting_list = false;

      if (event.capacity) {
        const [countRow] = await trx
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(eventRegistrants)
          .where(
            and(
              eq(eventRegistrants.event_uuid, event_uuid),
              or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin"))
            )
          )
          .execute();

        const approved_requests_count = countRow?.count || 0;
        const event_cap_filled = approved_requests_count >= event.capacity;

        event_filled_and_has_waiting_list = !!(event_cap_filled && event.has_waiting_list);

        if (event_cap_filled && !event.has_waiting_list) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Event Capacity Reached for event ${event.event_uuid}`,
          });
        }
      }

      const request_status = !!event.has_approval || event_filled_and_has_waiting_list ? "pending" : "approved";

      await trx.insert(eventRegistrants).values({
        event_uuid: event_uuid,
        user_id: userId,
        status: request_status,
        register_info: registerInfo,
      });

      return { request_status };
    });

    await addVisitor(userId, event_uuid);
    await redisTools.deleteCache(getUserCacheKey(userId));

    return { message: "success", code: 201, status: registrationResult.request_status };
  } finally {
    await redisTools.releaseLock(lockKey);
  }
});

const statusesZod = z.enum(["pending", "rejected", "approved", "checkedin"]);
const getEventRegistrants = evntManagerPP
  .input(
    z.object({
      event_uuid: z.string().uuid(),
      cursor: z.string().optional(),
      limit: z.number().default(10),
      search: z.string().optional(),
      statuses: z.array(statusesZod).optional(),
    })
  )
  .query(async (opts) => {
    const { event_uuid, cursor, limit, search, statuses } = opts.input;

    const event = await eventDB.selectEventByUuid(event_uuid);
    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Event not found with uuid ${event_uuid}` });
    }

    let condition = event.has_payment
      ? and(
          or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin")),
          eq(eventRegistrants.event_uuid, event_uuid)
        )
      : eq(eventRegistrants.event_uuid, event_uuid);

    if (search && search.trim() !== "") {
      const searchStr = `%${search.trim()}%`;
      condition = and(
        condition,
        or(
          like(dbLower(users.username), dbLower(searchStr)),
          like(dbLower(users.first_name), dbLower(searchStr)),
          like(dbLower(users.last_name), dbLower(searchStr))
        )
      );
    }

    if (statuses && statuses.length > 0) {
      condition = and(condition, or(...statuses.map((status) => eq(eventRegistrants.status, status))));
    }

    if (cursor) {
      condition = and(condition, lt(eventRegistrants.created_at, new Date(cursor)));
    }

    const registrants = await db
      .select({
        event_uuid: eventRegistrants.event_uuid,
        user_id: eventRegistrants.user_id,
        username: users.username,
        first_name: users.first_name,
        last_name: users.last_name,
        status: eventRegistrants.status,
        created_at: eventRegistrants.created_at,
        registrant_info: eventRegistrants.register_info,
      })
      .from(eventRegistrants)
      .innerJoin(users, eq(eventRegistrants.user_id, users.user_id))
      .where(condition)
      .orderBy(desc(eventRegistrants.created_at))
      .limit(limit + 1)
      .execute();

    let nextCursor: string | null = null;
    if (registrants.length > limit) {
      const nextItem = registrants.pop();
      nextCursor = nextItem?.created_at?.toISOString() || null;
    }

    return {
      registrants,
      nextCursor,
    };
  });

export const registrantRouter = router({
  checkinRegistrantRequest,
  processRegistrantRequest,
  eventRegister,
  getEventRegistrants,
});
