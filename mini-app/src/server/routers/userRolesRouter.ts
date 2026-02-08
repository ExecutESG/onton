import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EventUserEntry, userRolesDB } from "@/db/modules/userRoles.db";
import { adminOrganizerProtectedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";
import { accessRoleItemTypeSchema } from "@/db/schema/userRoles";
import { userRolesBulkUpsertInputSchema } from "@/zodSchema/userRoles";
import eventDB from "@/db/modules/events.db";
import { usersDB } from "@/db/modules/users.db";
import { UserRolesBulkUpsertInput } from "@/types/ActiveUserRole.types";

export const userRolesRouter = router({
  /**
   * List ALL user roles (both 'active' and 'reactive') for a given item.
   * itemType can be 'event' (or future types if you extend itemTypeEnum).
   */
  listAllUserRolesForEventId: adminOrganizerProtectedProcedure
    .input(z.number())
    .query(async ({ input }): Promise<UserRolesBulkUpsertInput[]> => {
      const itemId = input;
      const event = await eventDB.getEventById(itemId);
      if (!event) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Event with ID ${itemId} not found.`,
        });
      }
      try {
        return await userRolesDB.listAllUserRolesForEvent("event", itemId);
      } catch (error) {
        logger.error("Error in listAllUserRolesForEvent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list user roles.",
        });
      }
    }),

  /**
   * List only 'active' user roles for a given item (itemType + itemId).
   */
  listActiveUserRolesForEvent: adminOrganizerProtectedProcedure
    .input(
      z.object({
        itemType: accessRoleItemTypeSchema,
        itemId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { itemType, itemId } = input;
      const event = await eventDB.getEventById(itemId);
      if (!event) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Event with ID ${itemId} not found.`,
        });
      }

      try {
        return await userRolesDB.listActiveUserRolesForEvent(itemType, itemId);
      } catch (error) {
        logger.error("Error in listActiveUserRolesForEvent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list active user roles.",
        });
      }
    }),

  /**
   * Bulk upsert user roles for a given item (itemType + itemId).
   * - Expects an array of { username, active, role }
   * - If record exists => update status
   * - If not => insert
   * Example:
   * {{baseUrl}}/api/trpc/userRoles.bulkUpsertUserRolesForEvent?input={
   *   "itemType": "event",
   *   "itemId": 1280,
   *   "userList": [
   *     { "username": "@abs0lutelynot_me", "active": true, "role": "checkin_officer" }
   *   ]
   * }
   */
  bulkUpsertUserRolesForEvent: adminOrganizerProtectedProcedure
    .input(userRolesBulkUpsertInputSchema) // <--- use the separated schema
    .mutation(async ({ input, ctx }) => {
      const { itemType, itemId, userList } = input;
      const event = await eventDB.getEventById(itemId);
      if (!event) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Event with ID ${itemId} not found.`,
        });
      }
      try {
        // 1) Convert each username to user_id
        const convertedList: EventUserEntry[] = [];

        for (const { username, status, role } of userList) {
          // remove leading '@'
          const usernameStripped = username.replace(/^@/, "");

          const dbUser = await usersDB.selectUserByUsername(usernameStripped);

          if (dbUser === null) {
            // user not exist => throw error
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `@${username} is not a user of Onton.`,
            });
          }

          convertedList.push({ user_id: dbUser.user_id, status, role });
        }

        // 2) Bulk upsert via DB module
        const result = await userRolesDB.bulkUpsertUserRolesForEvent(
          itemType,
          itemId,
          convertedList,
          ctx.user?.user_id?.toString() ?? "system"
        );

        // 3) Check DB result
        if (!result.success) {
          // The DB function returned an error message => forward that
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error ?? "Failed to bulk upsert user roles",
          });
        }
        logger.info(`Bulk upserted user roles for item [${itemType}, ID=${itemId}]`, { userList });
        // 4) Return success
        try {
          return await userRolesDB.listAllUserRolesForEvent(itemType, itemId);
        } catch (error) {
          logger.error("Error in listAllUserRolesForEvent: ", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to list user roles.",
          });
        }
      } catch (error) {
        logger.error("Error in bulkUpsertUserRolesForEvent:", error);
        if (error instanceof TRPCError) {
          throw error; // rethrow the TRPC error
        } else {
          // Otherwise, wrap it in a TRPCError
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to bulk upsert user roles.",
            cause: error, // optional cause
          });
        }
      }
    }),
});
