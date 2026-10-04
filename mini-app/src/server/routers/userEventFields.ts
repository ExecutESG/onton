import bcryptLib from "@/lib/bcrypt";
import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_NUMBER } from "@trpc/server/http";
import { z } from "zod";
import { initDataProtectedProcedure, router } from "../trpc";
import userEventFieldsDB from "@/db/modules/userEventFields.db";
import { getEventById } from "@/db/modules/events.db";
import eventFieldsDB from "@/db/modules/eventFields.db";
import { checkRateLimit } from "@/lib/checkRateLimit";
import { EVENT_PASSWORD_RATE_LIMIT } from "@/constants";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";

export const userEventFieldsRouter = router({
  // protect
  upsertUserEventField: initDataProtectedProcedure
    .input(
      z.object({
        data: z.string(),
        field_id: z.number(),
        event_id: z.number(),
      })
    )
    .mutation(async (opts) => {
      const { allowed, remaining } = await checkRateLimit(
        String(opts.ctx.user.user_id),
        "userEventFields.upsertUserEventField",
        EVENT_PASSWORD_RATE_LIMIT.max,
        EVENT_PASSWORD_RATE_LIMIT.window
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please wait a minute.",
        });
      }
      const eventData = await getEventById(opts.input.event_id);

      if (eventData === null) {
        throw new TRPCError({
          message: "Event not found",
          code: "BAD_REQUEST",
        });
      }

      if (eventData.has_registration === true) {
        throw new TRPCError({
          message: "it is not possible to use the password for the events with registration",
          code: "BAD_REQUEST",
        });
      }
      const startDate = Number(eventData.start_date) * 1000;
      const endDate = Number(eventData.end_date) * 1000;

      if (Date.now() < startDate || Date.now() > endDate) {
        throw new TRPCError({
          message: "Event is not active",
          code: "FORBIDDEN",
        });
      }

      const inputField = await eventFieldsDB.getEventFields(opts.input.field_id);

      if (inputField.length === 0) {
        throw new TRPCError({
          message: "Field not found",
          code: "BAD_REQUEST",
        });
      }

      // Compare the entered password against the real password
      const enteredPassword = opts.input.data.trim().toLowerCase();

      const isRealPasswordCorrect = eventData.secret_phrase
        ? await bcryptLib.comparePassword(enteredPassword, eventData.secret_phrase)
        : false;

      if (!isRealPasswordCorrect) {
        throw new TRPCError({
          message: `Password incorrect, try again. ${remaining}/${EVENT_PASSWORD_RATE_LIMIT.max} attempts remaining.`,
          code: TRPC_ERROR_CODES_BY_NUMBER["-32003"],
        });
      }

      // Hash the entered password and store it
      const hashPassword = await bcryptLib.hashPassword(enteredPassword);

      await userEventFieldsDB.upsertUserEventFields(
        opts.ctx.user.user_id,
        opts.input.event_id,
        opts.input.field_id,
        hashPassword
      );

      // Record visitor attendance
      const visitor = await visitorsDB.addVisitor(opts.ctx.user.user_id, eventData.event_uuid);

      // Record attendee in eventRegistrants as checkedin for off-chain cSBT credentials and attendance tracking
      await db
        .insert(eventRegistrants)
        .values({
          event_uuid: eventData.event_uuid,
          user_id: opts.ctx.user.user_id,
          status: "checkedin",
          updatedBy: String(opts.ctx.user.user_id),
        })
        .onConflictDoUpdate({
          target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
          set: {
            status: "checkedin",
            updatedAt: new Date(),
            updatedBy: String(opts.ctx.user.user_id),
          },
        })
        .execute();

      // Ensure reward row is created for attendance tracking
      if (visitor) {
        const existingReward = await rewardDB.checkExistingRewardWithType(visitor.id, "ton_society_sbt");
        if (!existingReward) {
          await rewardDB.insertRewardRow(
            visitor.id,
            null,
            opts.ctx.user.user_id,
            "ton_society_sbt",
            "pending_creation",
            eventData
          );
        }
      }

      return { success: true };
    }),

  // protect
  getUserEventFields: initDataProtectedProcedure
    .input(
      z.object({
        event_hash: z.string(),
      })
    )
    .query(async (opts) => {
      try {
        const userEventFieldsResult = await userEventFieldsDB.getSecureUserEventFields(
          opts.ctx.user.user_id,
          opts.input.event_hash
        );

        if (!userEventFieldsResult || userEventFieldsResult.length === 0) {
          return {};
        }

        const data: { [key: string]: EventFieldData } = {};

        for (const field of userEventFieldsResult) {
          // console.log(field);

          data[field.eventFieldId ?? "unknown"] = {
            id: field.eventFieldId ?? "unknown",
            event_field_id: field.eventFieldId ?? "unknown",
            user_id: opts.ctx.user.user_id,
            data: field.userData ?? null,
            completed: field.completed ?? false,
            created_at: field.createdAt ?? null,
            // Map other necessary fields from userEventFields
          };
        }

        return data;
      } catch (error) {
        console.error("Error in getUserEventFields query:", error);

        if (error instanceof TRPCError) {
          throw error;
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred while retrieving user event fields",
          });
        }
      }
    }),
});

interface EventFieldData {
  id: number | string;
  event_field_id: number | string;
  user_id: number;
  data: any;
  completed: boolean;
  created_at: Date | null;
  // Add other necessary fields from userEventFields
}
