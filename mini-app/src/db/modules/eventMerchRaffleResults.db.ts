// db/modules/eventMerchRaffleResults.db.ts
import { db } from "@/db/db";
import { eventMerchRaffleResults, merchResultStatus } from "@/db/schema/eventMerchRaffleResults";
import { eventMerchRaffles } from "@/db/schema/eventMerchRaffles";
import { users } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import eventMerchRafflesDB from "./eventMerchRaffles.db";
import { InferSelectModel } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*                          TYPE EXPORTS                              */
/* ------------------------------------------------------------------ */
export type MerchResultRow = InferSelectModel<typeof eventMerchRaffleResults>;
export type MerchResultStatusType = (typeof merchResultStatus.enumValues)[number];

/* ------------------------------------------------------------------ */
/*                        BASIC INSERT                                */
/* ------------------------------------------------------------------ */
export const addUserScore = async (params: { merch_raffle_id: number; user_id: number; score: number }) =>
  db.insert(eventMerchRaffleResults).values(params).onConflictDoNothing().execute();

/* ------------------------------------------------------------------ */
/*                    RANK & ELIGIBILITY HELPERS                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*              SHIPPING / PICKUP STATE TRANSITIONS                   */
/* ------------------------------------------------------------------ */
export const saveShippingAddress = (
  id: number,
  fields: { full_name: string; shipping_address: string; zip_code?: string; phone?: string }
) =>
  db
    .update(eventMerchRaffleResults)
    .set({ ...fields, status: "awaiting_pickup", updated_at: new Date() })
    .where(eq(eventMerchRaffleResults.id, id))
    .execute();

export const markShipped = (id: number, trackingNumber: string | null = null) =>
  db
    .update(eventMerchRaffleResults)
    .set({
      status: "shipped",
      tracking_number: trackingNumber ?? undefined,
      shipped_at: new Date(),
    })
    .where(eq(eventMerchRaffleResults.id, id))
    .execute();

export const markDelivered = (id: number) =>
  db
    .update(eventMerchRaffleResults)
    .set({ status: "delivered", delivered_at: new Date() })
    .where(eq(eventMerchRaffleResults.id, id))
    .execute();

export const markCollected = (id: number) =>
  db
    .update(eventMerchRaffleResults)
    .set({ status: "collected", collected_at: new Date() })
    .where(eq(eventMerchRaffleResults.id, id))
    .execute();

/* bulk helpers */
export const markManyFailed = (ids: number[]) =>
  db.update(eventMerchRaffleResults).set({ status: "failed" }).where(inArray(eventMerchRaffleResults.id, ids)).execute();

/* ------------------------------------------------------------------ */
/*                             QUERIES                               */
/* ------------------------------------------------------------------ */
export const listAwaitingAddress = (merchRaffleId: number) =>
  db
    .select()
    .from(eventMerchRaffleResults)
    .where(
      and(eq(eventMerchRaffleResults.merch_raffle_id, merchRaffleId), eq(eventMerchRaffleResults.status, "awaiting_address"))
    )
    .execute();

export const fetchUserResult = async (merch_raffle_uuid: string, user_id: number) => {
  const merch = await eventMerchRafflesDB.fetchMerchRaffleByUuid(merch_raffle_uuid);
  if (!merch) return null;

  return (
    await db
      .select()
      .from(eventMerchRaffleResults)
      .where(
        and(eq(eventMerchRaffleResults.merch_raffle_id, merch.merchRaffleId), eq(eventMerchRaffleResults.user_id, user_id))
      )
  ).pop();
};

const eventMerchRaffleResultsDB = {
  addUserScore,

  saveShippingAddress,
  markShipped,
  markDelivered,
  markCollected,
  markManyFailed,
  listAwaitingAddress,
  fetchUserResult,
};
export default eventMerchRaffleResultsDB;
