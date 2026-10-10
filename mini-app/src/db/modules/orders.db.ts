import { db } from "@/db/db";
import { orders } from "@/db/schema";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { and, count, eq, isNull, not, or, sql } from "drizzle-orm";
import { is_dev_env, is_stage_env } from "../../server/utils/evnutils";
import { OrderTypeValues } from "@/db/schema/orders";
import eventTicketTiersDB from "@/db/modules/eventTicketTiers.db";

const getEventOrders = async (event_uuid: string) => {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.event_uuid, event_uuid),
        or(eq(orders.order_type, "event_creation"), eq(orders.order_type, "event_capacity_increment"))
      )
    );
};

/**
 * Update the state of a single order, returning the rows that were updated.
 */
const updateOrderState = async (orderUuid: string, userId: number, newState: "cancelled" | "confirming") => {
  const baseWhere = and(
    eq(orders.uuid, orderUuid),
    eq(orders.user_id, userId),
    or(eq(orders.state, "new"), eq(orders.state, "confirming"), eq(orders.state, "cancelled"), eq(orders.state, "completed"))
  );

  const finalWhere =
    newState === "confirming"
      ? sql`${baseWhere} AND "order_type" NOT IN ('event_creation', 'event_capacity_increment')`
      : baseWhere;

  const [existingOrder] = await db
    .select({ state: orders.state, tier_id: orders.tier_id, inventory_reserved: orders.inventory_reserved })
    .from(orders)
    .where(finalWhere!)
    .execute();

  const updatedRows = await db
    .update(orders)
    .set({
      state: newState,
      ...(newState === "cancelled" ? { inventory_reserved: false } : {}),
    })
    .where(finalWhere!)
    .returning({ uuid: orders.uuid })
    .execute();

  if (newState === "cancelled" && existingOrder?.tier_id) {
    if (existingOrder.inventory_reserved || existingOrder.state === "completed") {
      await eventTicketTiersDB.decrementTierSoldCount(existingOrder.tier_id, 1);
    }
  }

  return updatedRows;
};

async function checkIfSoldOut(event_uuid: string, ticketOrderType: OrderTypeValues, capacity: number) {
  const TicketsCount = await db
    .select({ ticket_count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.event_uuid, event_uuid),
        or(
          eq(orders.state, "completed"),
          eq(orders.state, "processing"),
          eq(orders.state, "confirming"),
          eq(orders.state, "new")
        ),
        eq(orders.order_type, ticketOrderType)
      )
    )
    .execute();

  return {
    isSoldOut: capacity > 0 && TicketsCount[0].ticket_count >= capacity,
    soldCount: TicketsCount[0].ticket_count,
  };
}

/**
 * Check if there's already a completed order for this event, user, and orderType.
 */
const findExistingCompletedOrder = async (eventUuid: string, telegramUserId: number, orderType: OrderTypeValues) =>
  db.query.orders.findFirst({
    where: and(
      eq(orders.user_id, telegramUserId),
      eq(orders.order_type, orderType),
      eq(orders.event_uuid, eventUuid),
      eq(orders.state, "completed")
    ),
  });

const findOrderByEventUser = async (eventUuid: string, telegramUserId: number) => {
  return db.query.orders.findMany({
    where: and(eq(orders.event_uuid, eventUuid), eq(orders.user_id, telegramUserId)),
    orderBy: (fields, { desc }) => [desc(fields.created_at)], // or desc(fields.id)
  });
};

const findOrderByEventUserByType = async (eventUuid: string, telegramUserId: number, orderType: OrderTypeValues) => {
  return db.query.orders.findMany({
    where: and(eq(orders.event_uuid, eventUuid), eq(orders.user_id, telegramUserId), eq(orders.order_type, orderType)),
    orderBy: (fields, { desc }) => [desc(fields.created_at)], // or desc(fields.id)
  });
};

// New method to get (userId, walletAddress, orderType) from completed orders:
export const getDistinctCompletedOwnerWallets = async (): Promise<
  {
    userId: number | null;
    walletAddress: string | null;
    orderType: OrderTypeValues;
  }[]
> => {
  return await db
    .select({
      userId: orders.user_id,
      walletAddress: orders.owner_address,
      orderType: orders.order_type,
    })
    .from(orders)
    .where(
      and(
        eq(orders.state, "completed"), // completed orders only
        not(isNull(orders.owner_address)) // skip null addresses
      )
    )
    .groupBy(orders.user_id, orders.owner_address, orders.order_type)
    .execute();
};

/**
 * Atomically claim order notification rights (once-only guard).
 * Uses UPDATE ... WHERE notified_at IS NULL RETURNING to guarantee exactly-once notification across concurrent workers.
 */
export const claimOrderNotification = async (orderUuid: string, trx?: any): Promise<boolean> => {
  const executor = trx || db;
  const result = await executor
    .update(orders)
    .set({ notified_at: new Date() })
    .where(and(eq(orders.uuid, orderUuid), isNull(orders.notified_at)))
    .returning({ uuid: orders.uuid })
    .execute();

  return result.length > 0;
};

const ordersDB = {
  getEventOrders,
  updateOrderState,
  checkIfSoldOut,
  findExistingCompletedOrder,
  findOrderByEventUser,
  findOrderByEventUserByType,
  getDistinctCompletedOwnerWallets,
  claimOrderNotification,
};

export default ordersDB;

