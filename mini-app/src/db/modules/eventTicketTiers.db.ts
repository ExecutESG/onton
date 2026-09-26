import { db } from "@/db/db";
import { eventTicketTiers, EventTicketTierRow } from "@/db/schema/eventTicketTiers";
import { eventPayment } from "@/db/schema/eventPayment";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/**
 * Fetch all ticket tiers for an event, ordered by sort_order.
 * If no explicit tiers exist, transparently synthesizes a fallback
 * General Admission tier from event_payment_info for 100% backward compatibility.
 */
export const getTiersByEventUuid = async (eventUuid: string): Promise<EventTicketTierRow[]> => {
  try {
    const tiers = await db
      .select()
      .from(eventTicketTiers)
      .where(eq(eventTicketTiers.event_uuid, eventUuid))
      .orderBy(asc(eventTicketTiers.sort_order), asc(eventTicketTiers.created_at))
      .execute();

    if (tiers.length > 0) {
      return tiers;
    }

    // Synthesize fallback tier from legacy event_payment_info
    const legacyPayment = await db.query.eventPayment.findFirst({
      where(fields, { eq }) {
        return eq(fields.event_uuid, eventUuid);
      },
    });

    if (legacyPayment) {
      const fallbackTier: EventTicketTierRow = {
        id: 0,
        event_uuid: legacyPayment.event_uuid!,
        tier_name: legacyPayment.title?.trim() || "General Admission",
        price: legacyPayment.price,
        capacity: legacyPayment.bought_capacity,
        sold_count: 0,
        ticket_type: legacyPayment.ticket_type,
        description: legacyPayment.description || "",
        sort_order: 0,
        created_at: legacyPayment.created_at || new Date(),
        updatedAt: legacyPayment.updatedAt || new Date(),
        updatedBy: "legacy_fallback",
      };
      return [fallbackTier];
    }

    return [];
  } catch (error) {
    logger.error(`eventTicketTiersDB.getTiersByEventUuid error for ${eventUuid}:`, error);
    return [];
  }
};

/**
 * Fetch a single ticket tier by ID.
 */
export const getTierById = async (id: number): Promise<EventTicketTierRow | undefined> => {
  try {
    const [tier] = await db
      .select()
      .from(eventTicketTiers)
      .where(eq(eventTicketTiers.id, id))
      .execute();

    return tier;
  } catch (error) {
    logger.error(`eventTicketTiersDB.getTierById error for ${id}:`, error);
    return undefined;
  }
};

/**
 * Create a new ticket tier.
 */
export const createTier = async (
  data: typeof eventTicketTiers.$inferInsert
): Promise<EventTicketTierRow | undefined> => {
  try {
    const [created] = await db
      .insert(eventTicketTiers)
      .values(data)
      .returning()
      .execute();

    return created;
  } catch (error) {
    logger.error("eventTicketTiersDB.createTier error:", error);
    return undefined;
  }
};

/**
 * Check if a ticket tier has reached its capacity.
 */
export const checkTierCapacity = async (
  tierId: number
): Promise<{ isSoldOut: boolean; soldCount: number; capacity: number }> => {
  try {
    const tier = await getTierById(tierId);
    if (!tier) {
      return { isSoldOut: false, soldCount: 0, capacity: 0 };
    }

    const isSoldOut = tier.capacity > 0 && tier.sold_count >= tier.capacity;
    return {
      isSoldOut,
      soldCount: tier.sold_count,
      capacity: tier.capacity,
    };
  } catch (error) {
    logger.error(`eventTicketTiersDB.checkTierCapacity error for ${tierId}:`, error);
    return { isSoldOut: false, soldCount: 0, capacity: 0 };
  }
};

/**
 * Atomically increment or decrement the sold_count for a tier.
 */
export const incrementTierSoldCount = async (
  tierId: number,
  delta: number = 1
): Promise<void> => {
  if (tierId <= 0) return; // Ignore synthesized fallback tiers

  try {
    await db
      .update(eventTicketTiers)
      .set({
        sold_count: sql`${eventTicketTiers.sold_count} + ${delta}`,
        updatedAt: new Date(),
        updatedBy: "system_order",
      })
      .where(eq(eventTicketTiers.id, tierId))
      .execute();
  } catch (error) {
    logger.error(`eventTicketTiersDB.incrementTierSoldCount error for ${tierId}:`, error);
  }
};

export const eventTicketTiersDB = {
  getTiersByEventUuid,
  getTierById,
  createTier,
  checkTierCapacity,
  incrementTierSoldCount,
};

export default eventTicketTiersDB;
