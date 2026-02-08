import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eventManagementProtectedProcedure as evntManagerPP, initDataProtectedProcedure, router } from "../trpc";
import { logger } from "@/server/utils/logger";
import ordersDB from "@/db/modules/orders.db";
import { selectUserById } from "@/db/modules/users.db";
import eventTokensDB from "@/db/modules/eventTokens.db";

// Hard-coded example event UUID
const hardCodedEventUuid = "4e76c66c-ef3d-483c-9836-a3e12815b044";

export const ordersRouter = router({
  // 1) Update order state
  updateOrderState: initDataProtectedProcedure
    .input(
      z.object({
        order_uuid: z.string().uuid(),
        state: z.enum(["cancelled", "confirming"]),
      })
    )
    .mutation(async (opts) => {
      const user_id = opts.ctx.user.user_id;
      const state = opts.input.state;
      const order_uuid = opts.input.order_uuid;

      try {
        // DB call moved to ordersDB
        const updatedRows = await ordersDB.updateOrderState(order_uuid, user_id, state);

        if (updatedRows.length > 0) {
          return { code: 200, message: "Order State Updated" };
        } else {
          return { code: 200, message: "Nothing to update" };
        }
      } catch (error) {
        logger.error("order_updateOrderState_internal_error", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),

  // 2) Get event orders
  getEventOrders: evntManagerPP.input(z.object({ event_uuid: z.string().uuid() })).query(async (opts) => {
    // DB call moved to ordersDB
    return ordersDB.getEventOrders(opts.input.event_uuid);
  }),

  // 3) Add a 'promote_to_organizer' order if user doesn't already have one
  addPromoteToOrganizerOrder: initDataProtectedProcedure
    .input(z.object({ user_id: z.number().optional() }))
    .mutation(async (opts) => {
      const user_id = opts.ctx.user.user_id;

      // Check if user is already an organizer
      const user = await selectUserById(user_id, false);
      if (user?.role === "organizer") {
        throw new TRPCError({ code: "CONFLICT", message: "User is already an organizer" });
      }

      // DB call: find existing promoter order
      const userOrder = await ordersDB.findPromoteToOrganizerOrder(user_id);
      if (userOrder) {
        if (userOrder.state === "processing") {
          throw new TRPCError({ code: "CONFLICT", message: "User already has a processing order" });
        }
        if (userOrder.state === "completed") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User has a completed 'promote to organizer' order",
          });
        }
        // If it's 'new', 'confirming', or 'cancelled', just return it
        const token = await eventTokensDB.getTokenById(Number(userOrder.token_id));
        return { ...userOrder, token };
      }

      // DB call: create a new 'promote_to_organizer' order
      const newOrder = await ordersDB.createPromoteToOrganizerOrder(user_id, hardCodedEventUuid);
      const inserted = newOrder[0];
      const token = await eventTokensDB.getTokenById(Number(inserted.token_id));
      return { ...inserted, token };
    }),

  // 4) Get a user's 'promote_to_organizer' order
  getPromoteToOrganizerOrder: initDataProtectedProcedure
    .input(z.object({ user_id: z.number().optional() }))
    .query(async (opts) => {
      const user_id = opts.ctx.user.user_id;
      // DB call moved to ordersDB
      const resultOrder = await ordersDB.getPromoteToOrganizerOrder(user_id);
      if (!resultOrder) return null;
      const token = await eventTokensDB.getTokenById(Number(resultOrder.token_id));

      return { ...resultOrder, token };
    }),
});
