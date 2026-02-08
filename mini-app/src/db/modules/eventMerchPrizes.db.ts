import { db } from "@/db/db";
import { eventMerchPrizes } from "@/db/schema/eventMerchPrizes";
import { InferSelectModel, eq, desc, isNotNull, and } from "drizzle-orm";
import { EventMerchNotifStatusType, eventMerchPrizeResults } from "@/db/schema/eventMerchPrizeResults";
import { users } from "../schema";

export type PrizeRow = InferSelectModel<typeof eventMerchPrizes>;

export const createPrize = async (
  merchRaffleId: number,
  values: Omit<PrizeRow, "merch_prize_id" | "created_at" | "updated_at" | "status" | "merch_raffle_id">
) =>
  (
    await db
      .insert(eventMerchPrizes)
      .values({ ...values, merch_raffle_id: merchRaffleId })
      .returning()
  ).pop();

export const updatePrize = (
  prizeId: number,
  patch: Partial<Omit<PrizeRow, "merch_prize_id" | "merch_raffle_id" | "created_at" | "updated_at">>
) =>
  db
    .update(eventMerchPrizes)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(eventMerchPrizes.merch_prize_id, prizeId))
    .returning()
    .then((r) => r.pop());

export const listPrizesForRaffle = (raffleId: number) =>
  db.select().from(eventMerchPrizes).where(eq(eventMerchPrizes.merch_raffle_id, raffleId)).execute();

/* quick helper to fetch prize + winners summary */

export const getPrizeWithWinners = async (prizeId: number) => {
  /* 1. prize row ------------------------------------------------------- */
  const [prize] = await db.select().from(eventMerchPrizes).where(eq(eventMerchPrizes.merch_prize_id, prizeId)).limit(1);
  if (!prize) return null;

  /* 2. winners + user profile ----------------------------------------- */
  const winners = await db
    .select({
      id: eventMerchPrizeResults.id,
      user_id: eventMerchPrizeResults.user_id,
      rank: eventMerchPrizeResults.rank,
      score: eventMerchPrizeResults.score,
      status: eventMerchPrizeResults.status,

      /* fulfil-state cols */
      shipping_address: eventMerchPrizeResults.shipping_address,
      zip_code: eventMerchPrizeResults.zip_code,
      phone: eventMerchPrizeResults.phone,
      tracking_number: eventMerchPrizeResults.tracking_number,
      shipped_at: eventMerchPrizeResults.shipped_at,
      delivered_at: eventMerchPrizeResults.delivered_at,
      collected_at: eventMerchPrizeResults.collected_at,

      /* profile */
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      photo_url: users.photo_url, // 👈 now included
    })
    .from(eventMerchPrizeResults)
    .innerJoin(users, eq(users.user_id, eventMerchPrizeResults.user_id))
    .where(eq(eventMerchPrizeResults.merch_prize_id, prizeId))
    .orderBy(eventMerchPrizeResults.rank)
    .execute();

  return { prize, winners };
};
const fetchPrizeById = async (prizeId: number) => {
  const [prize] = await db.select().from(eventMerchPrizes).where(eq(eventMerchPrizes.merch_prize_id, prizeId)).limit(1);
  return prize;
};

const eventMerchPrizesDB = {
  createPrize,
  updatePrize,
  listPrizesForRaffle,
  getPrizeWithWinners,
  fetchPrizeById,
};
export default eventMerchPrizesDB;
