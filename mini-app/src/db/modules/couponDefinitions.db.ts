import { db } from "@/db/db";
import { and, asc, eq } from "drizzle-orm";
import { coupon_definition } from "@/db/schema/coupon_definition";
import { logger } from "@/server/utils/logger";

interface AddCouponDefinitionParams {
  event_uuid: string;
  cpd_type: "percent" | "fixed";
  cpd_status: "active" | "inactive" | "expired";
  value: number; // numeric(8,3) in DB => you can store as number, Drizzle will handle
  start_date: Date;
  end_date: Date;
  count: number;
  used?: number; // if needed, default = 0
}

/**
 * Adds a new coupon_definition row.
 */
async function addCouponDefinition(params: AddCouponDefinitionParams) {
  const { used = 0 } = params;
  const [inserted] = await db
    .insert(coupon_definition)
    .values({
      event_uuid: params.event_uuid,
      cpd_type: params.cpd_type,
      cpd_status: params.cpd_status,
      value: params.value,
      start_date: params.start_date,
      end_date: params.end_date,
      count: params.count,
      used: used,
    })
    .returning(); // Drizzle supports returning() on PostgreSQL

  return inserted; // The inserted row
}

/**
 * Updates `value`, `start_date`, `end_date`, `count`
 * by `id` AND `event_uuid` to ensure it belongs to the correct event.
 */
export const updateCouponDefinition = async (params: {
  id: number;
  event_uuid: string;
  start_date: Date;
  end_date: Date;
}) => {
  const { id, event_uuid, ...updateData } = params;

  // Use .returning() to get back the updated rows
  const updatedRows = await db
    .update(coupon_definition)
    .set(updateData)
    .where(and(eq(coupon_definition.id, id), eq(coupon_definition.event_uuid, event_uuid)))
    .returning()
    .execute()
    .catch((err) => {
      throw new Error(`Failed to update coupon definition: ${err.message}`);
    });

  // Check if no rows were updated
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(`NOT_FOUND: No coupon definition found for id=${id} and event_uuid=${event_uuid}. (Nothing updated.)`);
  }

  return updatedRows; // or return updatedRows[0] if you only need the first row
};

/**
 * Updates ONLY the `used` field by `id` and `event_uuid`.
 */
async function updateCouponDefinitionUsed(params: { id: number; event_uuid: string; used: number }) {
  const { id, event_uuid, used } = params;
  await db
    .update(coupon_definition)
    .set({ used })
    .where(and(eq(coupon_definition.id, id), eq(coupon_definition.event_uuid, event_uuid)))
    .execute();
}

/**
 * Updates ONLY the `cpd_status` field by `id` and `event_uuid`.
 */
export const updateCouponDefinitionStatus = async (params: {
  id: number;
  event_uuid: string;
  status: "active" | "inactive" | "expired";
}) => {
  const { id, event_uuid, status } = params;

  // Use `.returning()` to get back the updated rows
  const updatedRows = await db
    .update(coupon_definition)
    .set({ cpd_status: status })
    .where(and(eq(coupon_definition.id, id), eq(coupon_definition.event_uuid, event_uuid)))
    .returning()
    .execute()
    .catch((err) => {
      logger.error("Error updating coupon definition status", { error: err, params });
      throw new Error(`Failed to update coupon definition status: ${err.message}`);
    });

  // If no rows were updated, that means no matching record
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(`NOT_FOUND: No coupon definition found for id=${id} and event_uuid=${event_uuid}. (Nothing updated.)`);
  }

  logger.log(`Updated coupon definition status to ${status} for id=${id}`, updatedRows);

  return updatedRows; // or updatedRows[0] if you only need the first row
};

/**
 * Retrieves all coupon_definition rows for a given `event_uuid`.
 */
async function getCouponDefinitionsByEventUuid(event_uuid: string) {
  return await db
    .select()
    .from(coupon_definition)
    .where(eq(coupon_definition.event_uuid, event_uuid))
    .orderBy(asc(coupon_definition.start_date))
    .execute()
    .catch((err) => {
      logger.error("Error fetching coupon definitions", { error: err, event_uuid });
      throw new Error(`Failed to fetch coupon definitions: ${err.message}`);
    });
}

/**
 * Retrieves a single coupon_definition by primary key `id`.
 */
async function getCouponDefinitionById(id: number) {
  const results = await db
    .select()
    .from(coupon_definition)
    .where(eq(coupon_definition.id, id))
    .execute()
    .catch((err) => {
      logger.error("Error fetching coupon definition", { error: err, id });
      throw new Error(`Failed to fetch coupon definition: ${err.message}`);
    });

  return results.length > 0 ? results[0] : null;
}

export const couponDefinitionsDB = {
  addCouponDefinition,
  updateCouponDefinition,
  updateCouponDefinitionUsed,
  updateCouponDefinitionStatus,
  getCouponDefinitionsByEventUuid,
  getCouponDefinitionById,
};
