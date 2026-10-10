import { db } from "@/db/db";
import { orders, eventTokens, users, organizerPayouts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { PLATFORM_FEE_PERCENT } from "@/constants/fees";
import { events } from "@/db/schema/events";
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

  
  getEventTreasury: evntManagerPP.input(z.object({ event_uuid: z.string().uuid() })).query(async (opts) => {
    const userRole = opts.ctx.user.role;
    const userId = opts.ctx.user.user_id;
    const event_uuid = opts.input.event_uuid;
    
    // Check if event owner or admin
    
    const event = await db.select().from(events).where(eq(events.event_uuid, event_uuid)).limit(1).execute();
    if (!event.length) throw new TRPCError({ code: "NOT_FOUND" });
    if (event[0].owner !== userId && userRole !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only owner and admin can access treasury" });
    }

    const completedOrders = await db.select({
       uuid: orders.uuid,
       total_price: orders.total_price,
       token_symbol: eventTokens.symbol,
       order_type: orders.order_type,
       created_at: orders.created_at,
       buyer_first_name: users.first_name,
       buyer_last_name: users.last_name,
       state: orders.state,
    }).from(orders)
      .innerJoin(eventTokens, eq(orders.token_id, eventTokens.token_id))
      .leftJoin(users, eq(orders.user_id, users.user_id))
      .where(and(eq(orders.event_uuid, event_uuid), eq(orders.state, 'completed')))
      .orderBy(desc(orders.created_at))
      .execute();

    const summaryMap = new Map();
    for (const order of completedOrders) {
       const currency = order.token_symbol || "UNKNOWN";
       if (!summaryMap.has(currency)) {
          summaryMap.set(currency, { currency, tickets_sold: 0, gross_revenue: 0 });
       }
       const stat = summaryMap.get(currency);
       if (order.order_type === 'ts_csbt_ticket' || order.order_type === 'nft_mint') {
          stat.tickets_sold += 1;
       }
       stat.gross_revenue += order.total_price;
    }

    const payouts = await db.select({
      token_symbol: eventTokens.symbol,
      amount: organizerPayouts.amount,
      paid_at: organizerPayouts.paid_at
    }).from(organizerPayouts)
      .leftJoin(eventTokens, eq(organizerPayouts.token_id, eventTokens.token_id))
      .where(eq(organizerPayouts.event_uuid, event_uuid))
      .execute();
      
    const payoutMap = new Map();
    for (const p of payouts) {
       payoutMap.set(p.token_symbol || "UNKNOWN", p);
    }
    
    // Add payout status to each summary
    const summaryList = Array.from(summaryMap.values()).map(s => {
       const p = payoutMap.get(s.currency);
       return {
         ...s,
         payout_status: p ? `Paid ${p.amount} on ${p.paid_at.toISOString().split('T')[0]}` : "Not requested"
       };
    });

    return {
      summary: summaryList,
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      
      orders: completedOrders
    };
  }),

  // 2) Get event orders
  getEventOrders: evntManagerPP.input(z.object({ event_uuid: z.string().uuid() })).query(async (opts) => {
    // DB call moved to ordersDB
    return ordersDB.getEventOrders(opts.input.event_uuid);
  }),
});
