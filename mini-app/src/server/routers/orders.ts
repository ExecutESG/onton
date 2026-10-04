import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eventManagementProtectedProcedure as evntManagerPP, initDataProtectedProcedure, router } from "../trpc";
import { logger } from "@/server/utils/logger";
import ordersDB from "@/db/modules/orders.db";

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
});
