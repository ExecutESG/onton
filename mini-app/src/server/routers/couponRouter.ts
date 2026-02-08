import { TRPCError } from "@trpc/server";
import { eventManagementProtectedProcedure, router } from "../trpc";
import { couponDefinitionsDB } from "@/db/modules/couponDefinitions.db";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import couponSchema from "@/zodSchema/couponSchema";
import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { parse as csvParse } from "csv-parse/sync";
import { coupon_items } from "@/db/schema/coupon_items";
import { generateRandomCode } from "@/server/utils/utils";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
const normaliseUsername = (u: string) =>
  u
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .trim();
export const couponRouter = router({
  /**
   * 1) Add Coupons (Definition + Items)
   */
  addCoupons: eventManagementProtectedProcedure.input(couponSchema.addCouponsSchema).mutation(async ({ input }) => {
    try {
      return await db.transaction(async () => {
        // 1) Insert new coupon_definition
        let definition;
        try {
          const eventData = await eventDB.getEventByUuid(input.event_uuid);

          if (!eventData?.event_uuid) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No event found.",
            });
          }

          if (input.count > 1000) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Can't Create more than 1000 codes",
            });
          }
          const percentage = Math.floor(Math.max(0, Math.min(input.value, 100)) + Number.EPSILON); // avoid negative values and cap at 100

          if (input.value > 100.0) {
            // avoid more than 100 percent discount
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "more than 100 percent discount is not present",
            });
          }

          definition = await couponDefinitionsDB.addCouponDefinition({
            event_uuid: input.event_uuid,
            cpd_type: "percent", // Hard-coded to percent
            cpd_status: "active",
            value: percentage,
            start_date: input.start_date,
            end_date: input.end_date,
            count: input.count,
            used: 0,
          });

          // If definition comes back null/undefined, fail early
          if (!definition) {
            logger.error("Failed to add coupon definition (null return).", { input });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to add coupon definition.",
            });
          }
        } catch (err) {
          logger.error("Error inserting coupon definition", { error: err, input });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error occurred while creating coupon definition.",
            cause: err, // attach original error if desired
          });
        }

        // 2) Bulk-insert coupon_items
        try {
          const insertedItems = await couponItemsDB.addCouponItems({
            coupon_definition_id: definition.id,
            event_uuid: input.event_uuid,
            quantity: input.count,
          });

          if (!insertedItems || insertedItems.length === 0) {
            logger.error("Failed to add coupon items (empty array).", { input });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to add coupon items.",
            });
          }

          return {
            success: true,
            definition,
            items: insertedItems,
          };
        } catch (err) {
          logger.error("Error inserting coupon items", { error: err, input });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error occurred while creating coupon items.",
            cause: err,
          });
        }
      });
    } catch (err) {
      // This catches anything thrown within the transaction callback.
      logger.error("Transaction failed for addCoupons.", { error: err, input });
      // If it's already a TRPCError, just rethrow; otherwise wrap it.
      if (err instanceof TRPCError) {
        throw err;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while adding coupons.",
        cause: err,
      });
    }
  }),
  addCouponsCsv: eventManagementProtectedProcedure
    .input(couponSchema.addCouponsCsvSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await db.transaction(async () => {
          /* 1️⃣  Parse CSV ------------------------------------------------ */
          let rows: { user_id?: string; user_name?: string }[];
          try {
            rows = csvParse(input.csv_text, {
              columns: true, // use headers
              skip_empty_lines: true,
              trim: true,
            }) as { user_id?: string; user_name?: string }[];
          } catch (err) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "CSV could not be parsed.",
              cause: err,
            });
          }

          if (rows.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV is empty." });
          if (rows.length > 5000)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Can't import more than 5 000 rows.",
            });

          /* 2️⃣  Pre-query existing users in ONE hit (faster) ------------- */
          const ids = rows.map((r) => r.user_id && Number(r.user_id)).filter(Boolean) as number[];

          const usernames = rows.map((r) => r.user_name && normaliseUsername(r.user_name)).filter(Boolean) as string[];

          const existingById = ids.length
            ? await db.select({ user_id: users.user_id }).from(users).where(inArray(users.user_id, ids))
            : [];

          const existingByUsername = usernames.length
            ? await db
                .select({ user_id: users.user_id, username: users.username })
                .from(users)
                .where(inArray(users.username, usernames))
            : [];

          const idSet = new Set(existingById.map((u) => u.user_id));
          const usernameMap = new Map(existingByUsername.map((u) => [u.username, u.user_id]));

          /* 3️⃣  Event & definition setup (unchanged) --------------------- */
          const eventData = await eventDB.getEventByUuid(input.event_uuid);
          if (!eventData?.event_uuid) throw new TRPCError({ code: "NOT_FOUND", message: "No event found." });

          const percentage = Math.floor(Math.max(0, Math.min(input.value, 100)) + Number.EPSILON);

          const definition = await couponDefinitionsDB.addCouponDefinition({
            event_uuid: input.event_uuid,
            cpd_type: "percent",
            cpd_status: "active",
            value: percentage,
            start_date: input.start_date,
            end_date: input.end_date,
            count: rows.length,
            used: 0,
          });

          if (!definition)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create coupon definition.",
            });

          /* 4️⃣  Build rows ----------------------------------------------- */
          const now = new Date();
          const payload = rows.map((r) => {
            // decide which identifier we have
            const rawId = r.user_id && Number(r.user_id);
            const rawUsername = !rawId && r.user_name ? normaliseUsername(r.user_name) : undefined;

            let invitedId: number | null = null;
            let status: "pending" | "failed" = "failed";
            let error: string | null = "NOT_ONTON_USER";

            if (rawId && idSet.has(rawId)) {
              invitedId = rawId;
              status = "pending";
              error = null;
            } else if (rawUsername && usernameMap.has(rawUsername)) {
              invitedId = usernameMap.get(rawUsername)!;
              status = "pending";
              error = null;
            }

            return {
              coupon_definition_id: definition.id,
              event_uuid: input.event_uuid,
              code: generateRandomCode(),
              coupon_status: "unused" as const,
              invited_user_id: invitedId,
              created_at: now,
              updated_at: now,
              message_status: status,
              last_send_error: error,
              send_attempts: 0,
            };
          });

          /* 5️⃣  Bulk insert --------------------------------------------- */
          const inserted = await db.insert(coupon_items).values(payload).returning({ id: coupon_items.id });

          if (!inserted.length)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to add coupon items.",
            });

          const failedCount = payload.filter((p) => p.message_status === "failed").length;

          return {
            success: true,
            definition,
            insertedCount: inserted.length,
            failedCount,
          };
        });
      } catch (err) {
        logger.error("addCouponsCsv failed", { error: err, input });
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unexpected error while adding coupons from CSV.",
          cause: err,
        });
      }
    }),
  /**
   *  Edit Dates Only
   */
  editCouponDefinitionDates: eventManagementProtectedProcedure
    .input(couponSchema.editCouponDatesSchema)
    .mutation(async ({ input }) => {
      const { id, event_uuid, start_date, end_date } = input;
      try {
        const eventData = await eventDB.getEventByUuid(event_uuid);

        if (!eventData?.event_uuid) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No event found.",
          });
        }
        await couponDefinitionsDB.updateCouponDefinition({
          id,
          event_uuid,
          start_date,
          end_date,
        });

        return { success: true };
      } catch (err: any) {
        // If our DB function threw a "No coupon definition found" error,
        // we can interpret that as NOT_FOUND.
        if (err.message?.includes("NOT_FOUND")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: err.message,
          });
        }

        logger.error("Error updating coupon definition dates", { error: err, input });
        if (err instanceof TRPCError) {
          throw err;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while updating coupon definition dates.",
          cause: err,
        });
      }
    }),

  /**
   * Update Coupon Definition Status
   */
  updateCouponDefinitionStatus: eventManagementProtectedProcedure
    .input(couponSchema.updateCouponDefinitionStatusSchema)
    .mutation(async ({ input }) => {
      const { id, event_uuid, status } = input;
      try {
        const eventData = await eventDB.getEventByUuid(event_uuid);

        if (!eventData?.event_uuid) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No event found.",
          });
        }
        const updatedRows = await couponDefinitionsDB.updateCouponDefinitionStatus({
          id,
          event_uuid,
          status,
        });

        return { success: true };
      } catch (err: any) {
        // If our DB function threw "No coupon definition found" error
        if (err.message?.includes("NOT_FOUND")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: err.message,
          });
        }

        logger.error("Error updating coupon definition status", { error: err, input });
        if (err instanceof TRPCError) {
          throw err;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while updating coupon definition status.",
          cause: err,
        });
      }
    }),

  /**
   * Get List of Definitions (by event_uuid)
   */
  getCouponDefinitions: eventManagementProtectedProcedure
    .input(couponSchema.getDefinitionsSchema)
    .query(async ({ input }) => {
      const { event_uuid } = input;
      try {
        const eventData = await eventDB.getEventByUuid(event_uuid);

        if (!eventData?.event_uuid) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No event found.",
          });
        }
        return await couponDefinitionsDB.getCouponDefinitionsByEventUuid(event_uuid);
      } catch (err: any) {
        // If we threw "No coupon definitions found" in the DB layer, interpret that as NOT_FOUND
        if (err.message?.includes("NOT_FOUND")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: err.message,
          });
        }

        logger.error("Error fetching coupon definitions", { error: err, input });
        if (err instanceof TRPCError) {
          throw err;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while fetching coupon definitions.",
          cause: err,
        });
      }
    }),

  /**
   * Get List of Items (by coupon_definition_id)
   */
});
