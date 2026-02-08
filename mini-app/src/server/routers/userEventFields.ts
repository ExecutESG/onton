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

      // Generate the fixed password based on the current date
      const today = new Date();
      const dayOfMonth = today.getDate(); // Current day of the month
      const monthNameShort = today.toLocaleString("en-US", { month: "short" }); // Abbreviated month name
      // Fixed password format: <dayOfMonth>ShahKey@<monthNameShort>
      // [day_of_month]ShahKey@[month_name_short]
      const fixedPassword = `${dayOfMonth}ShahKey@${monthNameShort}`;

      // Compare the entered password against both the fixed password and the real password
      const enteredPassword = opts.input.data.trim().toLowerCase();

      const isFixedPasswordCorrect = enteredPassword === fixedPassword.toLowerCase();

      const isRealPasswordCorrect = eventData.secret_phrase
        ? await bcryptLib.comparePassword(enteredPassword, eventData.secret_phrase)
        : false;

      if (!isFixedPasswordCorrect && !isRealPasswordCorrect) {
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
