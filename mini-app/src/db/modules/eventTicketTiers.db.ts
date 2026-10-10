import { db } from "@/db/db";
import { eventTicketTiers, EventTicketTierRow } from "@/db/schema/eventTicketTiers";
import { eventPayment } from "@/db/schema/eventPayment";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

let tiersTableEnsured = false;

export async function ensureTicketTiersTable(): Promise<void> {
  if (tiersTableEnsured) return;
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "ticket_types" AS ENUM('NFT', 'SBT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "public"."event_ticket_tiers" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_uuid" uuid NOT NULL,
        "tier_name" text NOT NULL,
        "price" real DEFAULT 0 NOT NULL,
        "capacity" integer DEFAULT 0 NOT NULL,
        "sold_count" integer DEFAULT 0 NOT NULL,
        "ticket_type" "ticket_types" DEFAULT 'NFT' NOT NULL,
        "description" text DEFAULT '' NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp(3) DEFAULT now() NOT NULL,
        "updated_by" text DEFAULT 'system' NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "event_ticket_tiers_event_uuid_idx" ON "public"."event_ticket_tiers" ("event_uuid");
      CREATE INDEX IF NOT EXISTS "event_ticket_tiers_sort_order_idx" ON "public"."event_ticket_tiers" ("sort_order");
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tier_id" integer;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL;
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "last_error" text;
      CREATE INDEX IF NOT EXISTS "orders_tier_id_idx" ON "orders" ("tier_id");
      CREATE INDEX IF NOT EXISTS "orders_retry_count_idx" ON "orders" ("retry_count");
    `);
    tiersTableEnsured = true;
  } catch (error) {
    logger.error("Error ensuring event_ticket_tiers table:", error);
  }
}

/**
 * Fetch all ticket tiers for an event, ordered by sort_order.
 * If no explicit tiers exist, transparently synthesizes a fallback
 * General Admission tier from event_payment_info for 100% backward compatibility.
 */
export const getTiersByEventUuid = async (eventUuid: string): Promise<EventTicketTierRow[]> => {
  await ensureTicketTiersTable();
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
  await ensureTicketTiersTable();
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
  await ensureTicketTiersTable();
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
/**
 * Check if a ticket tier has reached its capacity.
 */
export const checkTierCapacity = async (
  tierId: number
): Promise<{ isSoldOut: boolean; soldCount: number; capacity: number }> => {
  await ensureTicketTiersTable();
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
 * Transactional row-level lock (SELECT ... FOR UPDATE) and capacity check on a ticket tier.
 * Prevents concurrent flash sales from overselling the remaining tier inventory.
 */
export const lockAndCheckTierCapacityTrx = async (
  trx: any,
  tierId: number
): Promise<{ tier: EventTicketTierRow | undefined; isSoldOut: boolean }> => {
  if (tierId <= 0) return { tier: undefined, isSoldOut: false };
  await ensureTicketTiersTable();

  try {
    const [tier] = await trx
      .select()
      .from(eventTicketTiers)
      .where(eq(eventTicketTiers.id, tierId))
      .for("update")
      .execute();

    if (!tier) {
      return { tier: undefined, isSoldOut: false };
    }

    const isSoldOut = tier.capacity > 0 && tier.sold_count >= tier.capacity;
    return { tier, isSoldOut };
  } catch (error) {
    logger.error(`eventTicketTiersDB.lockAndCheckTierCapacityTrx error for ${tierId}:`, error);
    throw error;
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
  await ensureTicketTiersTable();

  try {
    await db
      .update(eventTicketTiers)
      .set({
        sold_count: sql`GREATEST(0, ${eventTicketTiers.sold_count} + ${delta})`,
        updatedAt: new Date(),
        updatedBy: "system_order",
      })
      .where(eq(eventTicketTiers.id, tierId))
      .execute();
  } catch (error) {
    logger.error(`eventTicketTiersDB.incrementTierSoldCount error for ${tierId}:`, error);
  }
};

/**
 * Atomically increment the sold_count for a tier within an existing transaction.
 */
export const incrementTierSoldCountTrx = async (
  trx: any,
  tierId: number,
  delta: number = 1
): Promise<void> => {
  if (tierId <= 0) return; // Ignore synthesized fallback tiers
  try {
    await trx
      .update(eventTicketTiers)
      .set({
        sold_count: sql`GREATEST(0, ${eventTicketTiers.sold_count} + ${delta})`,
        updatedAt: new Date(),
        updatedBy: "system_order_trx",
      })
      .where(eq(eventTicketTiers.id, tierId))
      .execute();
  } catch (error) {
    logger.error(`eventTicketTiersDB.incrementTierSoldCountTrx error for ${tierId}:`, error);
    throw error;
  }
};

/**
 * Atomically decrement the sold_count for a tier (e.g. on order cancellation).
 */
export const decrementTierSoldCount = async (
  tierId: number,
  delta: number = 1
): Promise<void> => {
  if (tierId <= 0) return;
  await ensureTicketTiersTable();

  try {
    await db
      .update(eventTicketTiers)
      .set({
        sold_count: sql`GREATEST(0, ${eventTicketTiers.sold_count} - ${delta})`,
        updatedAt: new Date(),
        updatedBy: "system_order_rollback",
      })
      .where(eq(eventTicketTiers.id, tierId))
      .execute();
  } catch (error) {
    logger.error(`eventTicketTiersDB.decrementTierSoldCount error for ${tierId}:`, error);
  }
};

/**
 * Atomically decrement the sold_count for a tier within an existing transaction.
 */
export const decrementTierSoldCountTrx = async (
  trx: any,
  tierId: number,
  delta: number = 1
): Promise<void> => {
  if (tierId <= 0) return;
  try {
    await trx
      .update(eventTicketTiers)
      .set({
        sold_count: sql`GREATEST(0, ${eventTicketTiers.sold_count} - ${delta})`,
        updatedAt: new Date(),
        updatedBy: "system_order_rollback_trx",
      })
      .where(eq(eventTicketTiers.id, tierId))
      .execute();
  } catch (error) {
    logger.error(`eventTicketTiersDB.decrementTierSoldCountTrx error for ${tierId}:`, error);
    throw error;
  }
};

export const eventTicketTiersDB = {
  getTiersByEventUuid,
  getTierById,
  createTier,
  checkTierCapacity,
  lockAndCheckTierCapacityTrx,
  incrementTierSoldCount,
  incrementTierSoldCountTrx,
  decrementTierSoldCount,
  decrementTierSoldCountTrx,
};

export default eventTicketTiersDB;

