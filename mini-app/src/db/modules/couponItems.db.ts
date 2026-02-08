import { db } from "@/db/db";
import { and, eq } from "drizzle-orm";
import { coupon_items, CouponItem } from "@/db/schema/coupon_items";
import { generateRandomCode } from "@/server/utils/utils";

interface BulkAddCouponItemsParams {
  coupon_definition_id: number;
  event_uuid: string;
  quantity: number; // how many coupon items we want to add
}

/**
 * Bulk add N coupon_items with random codes.
 */
export const addCouponItems = async (params: BulkAddCouponItemsParams) => {
  const { coupon_definition_id, event_uuid, quantity } = params;

  // We'll do at most N attempts to resolve collisions:
  const MAX_RETRIES = 5;
  let attempt = 0;

  // We store any inserted items here:
  let inserted: CouponItem[] = [];

  while (attempt < MAX_RETRIES) {
    // 1) Generate in-memory distinct codes to reduce chance of collision
    const codes = new Set<string>();
    while (codes.size < quantity) {
      codes.add(generateRandomCode(8));
    }
    const itemsToInsert = Array.from(codes).map((code) => ({
      coupon_definition_id,
      event_uuid,
      code,
      coupon_status: "unused" as const,
    }));

    try {
      // 2) Attempt insertion
      inserted = await db.insert(coupon_items).values(itemsToInsert).returning();

      // 3) If successful, break out of the loop
      return inserted; // we can just return here
    } catch (error: any) {
      // 4) Check if it's a unique violation:
      if (error.message?.includes("duplicate key value violates unique constraint")) {
        attempt++;
        // Possibly log a warning
        console.warn(`Duplicate code collision detected. Retrying... (attempt=${attempt})`);
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Failed to insert coupon items after ${MAX_RETRIES} attempts due to code collisions.`);
        }
      } else {
        // If it's some other error, rethrow
        throw error;
      }
    }
  }

  // If we exit the loop, throw an error, though we handle it above.
  throw new Error(`Could not insert coupon items after ${MAX_RETRIES} attempts.`);
};

/**
 * Updates coupon_status by `id` and `event_uuid`.
 */
const updateCouponItemStatus = async (params: { id: number; event_uuid: string; coupon_status: "used" | "unused" }) => {
  const { id, event_uuid, coupon_status } = params;

  await db
    .update(coupon_items)
    .set({ coupon_status })
    .where(and(eq(coupon_items.id, id), eq(coupon_items.event_uuid, event_uuid)))
    .execute();
};

/**
 * Retrieves a single coupon_item by `id`.
 */
const getCouponItemById = async (id: number) => {
  const results = await db.select().from(coupon_items).where(eq(coupon_items.id, id)).execute();

  return results.length > 0 ? results[0] : null;
};

/**
 * Retrieves all coupon_items by `coupon_definition_id` (the "group ID").
 */
const getCouponItemsByDefinitionId = async (coupon_definition_id: number) =>
  await db.select().from(coupon_items).where(eq(coupon_items.coupon_definition_id, coupon_definition_id)).execute();

const getCouponItemsByEventUuid = async (event_uuid: string) =>
  await db.select().from(coupon_items).where(eq(coupon_items.event_uuid, event_uuid)).execute();

const hasActiveCouponItems = async (event_uuid: string) => {
  const results = await db
    .select()
    .from(coupon_items)
    .where(and(eq(coupon_items.event_uuid, event_uuid), eq(coupon_items.coupon_status, "unused")))
    .execute();

  return results.length > 0;
};

const getByCodeAndEventUuid = async (code: string, event_uuid: string) => {
  const results = await db
    .select()
    .from(coupon_items)
    .where(and(eq(coupon_items.code, code), eq(coupon_items.event_uuid, event_uuid)))
    .execute();

  return results.length > 0 ? results[0] : null;
};

const makeCouponItemUsedTrx = async (
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  coupon_item_id: number,
  event_uuid: string
) => {
  await trx
    .update(coupon_items)
    .set({ coupon_status: "used" })
    .where(and(eq(coupon_items.id, coupon_item_id), eq(coupon_items.event_uuid, event_uuid)))
    .execute();
};

export const couponItemsDB = {
  addCouponItems,
  updateCouponItemStatus,
  getCouponItemById,
  getCouponItemsByDefinitionId,
  getCouponItemsByEventUuid,
  hasActiveCouponItems,
  getByCodeAndEventUuid,
  makeCouponItemUsedTrx,
};
