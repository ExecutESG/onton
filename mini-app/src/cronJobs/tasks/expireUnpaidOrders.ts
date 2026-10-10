import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import eventTicketTiersDB from "@/db/modules/eventTicketTiers.db";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/** Default timeout for unpaid ticket orders to release reserved inventory (15 minutes). */
export const UNPAID_ORDER_EXPIRY_MINUTES = 15;

/**
 * Sweeps for unpaid orders that reserved tier inventory but were never paid (#1055).
 * Cancels them and releases the reserved capacity back to the tier.
 * Only cancels orders in 'new' state (never 'confirming').
 */
export async function expireUnpaidOrders(expiryMinutes: number = UNPAID_ORDER_EXPIRY_MINUTES): Promise<number> {
  const expiryCutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);

  const expiredOrders = await db
    .select({
      uuid: orders.uuid,
      tier_id: orders.tier_id,
      state: orders.state,
    })
    .from(orders)
    .where(
      and(
        eq(orders.inventory_reserved, true),
        eq(orders.state, "new"),
        lt(sql`COALESCE(${orders.reserved_at}, ${orders.created_at})`, expiryCutoff)
      )
    )
    .execute();

  if (expiredOrders.length === 0) {
    return 0;
  }

  let releasedCount = 0;

  for (const ord of expiredOrders) {
    try {
      await db.transaction(async (trx) => {
        const [updated] = await trx
          .update(orders)
          .set({
            state: "cancelled",
            last_error: "order_expired_unpaid",
            inventory_reserved: false,
            updatedAt: new Date(),
            updatedBy: "expire_unpaid_orders_cron",
          })
          .where(
            and(
              eq(orders.uuid, ord.uuid),
              eq(orders.state, "new"),
              eq(orders.inventory_reserved, true)
            )
          )
          .returning({ uuid: orders.uuid })
          .execute();

        if (updated && ord.tier_id) {
          await eventTicketTiersDB.decrementTierSoldCountTrx(trx, ord.tier_id, 1);
          releasedCount++;
          logger.info(`[OrderExpiry] Expired unpaid order ${ord.uuid}, released tier ${ord.tier_id}`);
        }
      });
    } catch (err) {
      logger.error(`[OrderExpiry] Failed to expire order ${ord.uuid}:`, err);
    }
  }

  return releasedCount;
}

export default expireUnpaidOrders;
