import { db } from "@/db/db";
import { orders } from "@/db/schema";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { and, count, eq, isNull, not, or } from "drizzle-orm";
import { is_dev_env, is_stage_env } from "../../server/utils/evnutils";
import { OrderTypeValues } from "@/db/schema/orders";
import { ORGANIZER_PROMOTE_PRICE } from "@/constants";

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
  return db
    .update(orders)
    .set({ state: newState })
    .where(
      and(
        eq(orders.uuid, orderUuid),
        eq(orders.user_id, userId),
        or(eq(orders.state, "new"), eq(orders.state, "confirming"), eq(orders.state, "cancelled"))
      )
    )
    .returning({ uuid: orders.uuid })
    .execute();
};

/**
 * Find a single 'promote_to_organizer' order for a user.
 * Returns the latest one by .pop(), or null if none.
 */
const findPromoteToOrganizerOrder = async (userId: number) => {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.user_id, userId), eq(orders.order_type, "promote_to_organizer")))
    .execute();

  return rows.pop() ?? null; // Return the last item, or null if empty
};

/**
 * Create a new 'promote_to_organizer' order for a user,
 * and return the newly inserted row(s).
 */
const createPromoteToOrganizerOrder = async (userId: number, eventUuid: string) => {
  const tonToken = await eventTokensDB.getTokenBySymbol("TON");
  if (!tonToken) throw new Error("TON token not configured");
  return db
    .insert(orders)
    .values({
      order_type: "promote_to_organizer",
      user_id: userId,
      token_id: tonToken.token_id,
      total_price: ORGANIZER_PROMOTE_PRICE,
      state: "new",
      event_uuid: eventUuid,
    })
    .returning()
    .execute();
};

/**
 * Find the first 'promote_to_organizer' order for a user.
 * Using Drizzle's new query API for convenience.
 */
const getPromoteToOrganizerOrder = async (userId: number) => {
  return db.query.orders.findFirst({
    where: and(eq(orders.user_id, userId), eq(orders.order_type, "promote_to_organizer")),
  });
};

async function checkIfSoldOut(event_uuid: string, ticketOrderType: OrderTypeValues, capacity: number) {
  const TicketsCount = await db
    .select({ ticket_count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.event_uuid, event_uuid),
        or(eq(orders.state, "completed"), eq(orders.state, "processing")),
        eq(orders.order_type, ticketOrderType)
      )
    )
    .execute();

  return { isSoldOut: TicketsCount[0].ticket_count >= capacity, soldCount: TicketsCount[0].ticket_count };
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

/** Returns all "event_creation" orders in a "processing" state. */
const getProcessingEventCreationOrders = async () =>
  db
    .select()
    .from(orders)
    .where(and(eq(orders.state, "processing"), eq(orders.order_type, "event_creation")))
    .execute();

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

const ordersDB = {
  getEventOrders,
  updateOrderState,
  findPromoteToOrganizerOrder,
  createPromoteToOrganizerOrder,
  getPromoteToOrganizerOrder,
  checkIfSoldOut,
  findExistingCompletedOrder,
  findOrderByEventUser,
  getProcessingEventCreationOrders,
  findOrderByEventUserByType,
  getDistinctCompletedOwnerWallets,
};

export default ordersDB;
