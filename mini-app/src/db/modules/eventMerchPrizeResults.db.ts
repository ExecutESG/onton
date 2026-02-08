import { db } from "@/db/db";
import {
  EventMerchNotifStatusType,
  eventMerchPrizeResults,
  EventMerchPrizeResultStatusType,
} from "@/db/schema/eventMerchPrizeResults";
import { eventMerchPrizes } from "@/db/schema/eventMerchPrizes";
import { eventMerchRaffles } from "@/db/schema/eventMerchRaffles";
import { eq, desc, and, sql, isNull, isNotNull, or } from "drizzle-orm";
import { users } from "../schema";

/* simple insert used by spin-handler */

/* compute ranks + eligibility per *prize* */
export const computeTopN = async (prizeId: number) => {
  const [{ top_n, need_shipping }] = await db
    .select({
      top_n: eventMerchPrizes.top_n,
      need_shipping: eventMerchPrizes.need_shipping,
    })
    .from(eventMerchPrizes)
    .where(eq(eventMerchPrizes.merch_prize_id, prizeId))
    .limit(1);

  const rows = await db
    .select()
    .from(eventMerchPrizeResults)
    .where(eq(eventMerchPrizeResults.merch_prize_id, prizeId))
    .orderBy(desc(eventMerchPrizeResults.score), eventMerchPrizeResults.id)
    .execute();

  for (let i = 0; i < rows.length; i++) {
    const rank = i + 1;
    await db
      .update(eventMerchPrizeResults)
      .set({
        rank,
        status: rank <= top_n ? (need_shipping ? "awaiting_address" : "awaiting_pickup") : "pending",
      })
      .where(eq(eventMerchPrizeResults.id, rows[i].id))
      .execute();
  }
};

export const getPrizeWithWinners = async (prizeId: number) => {
  const [prize] = await db.select().from(eventMerchPrizes).where(eq(eventMerchPrizes.merch_prize_id, prizeId)).limit(1);
  if (!prize) return null;

  const winners = await db
    .select()
    .from(eventMerchPrizeResults)
    .where(eq(eventMerchPrizeResults.merch_prize_id, prizeId))
    .orderBy(eventMerchPrizeResults.rank)
    .execute();

  return { prize, winners };
};
export const fetchUserRow = async (params: { merch_prize_id: number; user_id: number }) => {
  const row = await db
    .select()
    .from(eventMerchPrizeResults)
    .where(
      and(
        eq(eventMerchPrizeResults.merch_prize_id, params.merch_prize_id),
        eq(eventMerchPrizeResults.user_id, params.user_id)
      )
    )

    .limit(1)
    .execute();

  return row[0] || null;
};
/**
 * How many distinct score-rows are recorded for a merch prize?
 * @returns number (0-n)
 */
export const countParticipantsForMerchPrize = async (merchPrizeId: number, tx = db): Promise<number> => {
  const [{ cnt }] = await tx
    .select({ cnt: sql<number>`count(*)` })
    .from(eventMerchPrizeResults)
    .where(eq(eventMerchPrizeResults.merch_prize_id, merchPrizeId));

  return Number(cnt);
};

/* add one raw score (no prize yet) */
export const addUserScore = async ({
  merch_raffle_id,
  user_id,
  score,
}: {
  merch_raffle_id: number;
  user_id: number;
  score: number;
}) =>
  db
    .insert(eventMerchPrizeResults)
    .values({
      merch_raffle_id,
      user_id,
      score,
    })
    .returning();
/* pool of ALL un-assigned scores for a raffle, descending by score */

/* assign a concrete prize + rank */
export const assignPrize = async ({
  id,
  merch_prize_id,
  rank,
  status,
}: {
  id: number;
  merch_prize_id: number;
  rank: number;
  status: EventMerchPrizeResultStatusType;
}) =>
  db
    .update(eventMerchPrizeResults)
    .set({
      merch_prize_id,
      rank,
      status,
      updated_at: new Date(),
    })
    .where(eq(eventMerchPrizeResults.id, id));

/* fulfilment status transitions for prize results */
export const markPrizeShipped = async (id: number, trackingNumber: string | null = null) =>
  db
    .update(eventMerchPrizeResults)
    .set({ status: "shipped", tracking_number: trackingNumber ?? undefined, shipped_at: new Date(), updated_at: new Date() })
    .where(eq(eventMerchPrizeResults.id, id))
    .execute();

export const markPrizeDelivered = async (id: number) =>
  db
    .update(eventMerchPrizeResults)
    .set({ status: "delivered", delivered_at: new Date(), updated_at: new Date() })
    .where(eq(eventMerchPrizeResults.id, id))
    .execute();

export const markPrizeCollected = async (id: number) =>
  db
    .update(eventMerchPrizeResults)
    .set({ status: "collected", collected_at: new Date(), updated_at: new Date() })
    .where(eq(eventMerchPrizeResults.id, id))
    .execute();

/** Fetch a prize-result row with its prize and parent raffle event ID for authorization checks */
export const fetchResultWithPrizeAndEvent = async (id: number) =>
  db
    .select({
      id: eventMerchPrizeResults.id,
      merch_prize_id: eventMerchPrizeResults.merch_prize_id,
      merch_raffle_id: eventMerchPrizes.merch_raffle_id,
      event_id: eventMerchRaffles.eventId,
      status: eventMerchPrizeResults.status,
    })
    .from(eventMerchPrizeResults)
    .leftJoin(eventMerchPrizes, eq(eventMerchPrizes.merch_prize_id, eventMerchPrizeResults.merch_prize_id))
    .leftJoin(eventMerchRaffles, eq(eventMerchRaffles.merchRaffleId, eventMerchPrizes.merch_raffle_id))
    .where(eq(eventMerchPrizeResults.id, id))
    .limit(1)
    .then((r) => r[0] || null);
/**
 * Return **all** un-assigned spin rows for a given merch raffle,
 * ordered by score **DESC** (highest first).
 *
 * These rows are the pool that organiser-side code consumes when it
 * allocates concrete prizes.
 */
export const fetchUnassignedScores = (merch_raffle_id: number) =>
  db
    .select()
    .from(eventMerchPrizeResults)
    .where(and(eq(eventMerchPrizeResults.merch_raffle_id, merch_raffle_id), isNull(eventMerchPrizeResults.merch_prize_id)))
    .orderBy(desc(eventMerchPrizeResults.score));

/* NEW — grab *any* row for a raffle/user (assigned or not) */
export const fetchRowByRaffleAndUser = ({ merch_raffle_id, user_id }: { merch_raffle_id: number; user_id: number }) =>
  db
    .select()
    .from(eventMerchPrizeResults)
    .where(and(eq(eventMerchPrizeResults.merch_raffle_id, merch_raffle_id), eq(eventMerchPrizeResults.user_id, user_id)))
    .limit(1)
    .then((r) => r[0]);

/* already had this one – unchanged */
export const fetchUnassignedRow = ({ merch_raffle_id, user_id }: { merch_raffle_id: number; user_id: number }) =>
  db
    .select()
    .from(eventMerchPrizeResults)
    .where(
      and(
        eq(eventMerchPrizeResults.merch_raffle_id, merch_raffle_id),
        eq(eventMerchPrizeResults.user_id, user_id),
        isNull(eventMerchPrizeResults.merch_prize_id)
      )
    )
    .limit(1)
    .then((r) => r[0]);

/**
 * Winners that still need a Telegram notification (`notif_status = 'waiting'`)
 * for a particular merch prize.
 * Returned with user‐profile fields attached.
 */
export const fetchUnsentWinners = async (prizeId: number) =>
  db
    .select({
      /* result-table columns */
      id: eventMerchPrizeResults.id,
      merch_prize_id: eventMerchPrizeResults.merch_prize_id,
      user_id: eventMerchPrizeResults.user_id,
      score: eventMerchPrizeResults.score,
      rank: eventMerchPrizeResults.rank,
      status: eventMerchPrizeResults.status,
      notif_status: eventMerchPrizeResults.notif_status,
      /* profile fields from users */
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      photo_url: users.photo_url,
    })
    .from(eventMerchPrizeResults)
    .innerJoin(users, eq(users.user_id, eventMerchPrizeResults.user_id))
    .where(
      and(
        eq(eventMerchPrizeResults.merch_prize_id, prizeId),
        eq(eventMerchPrizeResults.notif_status, "waiting"),
        isNotNull(eventMerchPrizeResults.rank) // only real winners
      )
    );

/* mark one row -> new notification status  */
export const setNotifStatus = async (id: number, status: EventMerchNotifStatusType) =>
  db
    .update(eventMerchPrizeResults)
    .set({ notif_status: status, updated_at: new Date() })
    .where(eq(eventMerchPrizeResults.id, id))
    .execute();
// ───────────────────────────────────────────────────────────────
//  Add just below the other helpers in eventMerchPrizeResults.db
// ───────────────────────────────────────────────────────────────
export const setContactInfo = async (args: {
  merch_prize_id: number;
  user_id: number;
  full_name: string;
  shipping_address: string;
  zip_code: string;
  phone: string;
}) =>
  db
    .update(eventMerchPrizeResults)
    .set({
      full_name: args.full_name,
      shipping_address: args.shipping_address,
      zip_code: args.zip_code,
      phone: args.phone,
      notif_status: "sent", // optional – you may keep “pending” if you prefer
      status: "awaiting_shipping", // ship-flow; pickup flow handled in proc
      updated_at: new Date(),
    })
    .where(
      and(eq(eventMerchPrizeResults.merch_prize_id, args.merch_prize_id), eq(eventMerchPrizeResults.user_id, args.user_id))
    )
    .execute();

/**
 * Returns **everyone who has spun** for the merch-raffle that this
 * `prizeId` belongs to – including:
 *   • rows already assigned to the prize          (`r.merch_prize_id = prizeId`)
 *   • “un-assigned” rows (spins) that haven’t been allocated to
 *     any prize yet (`merch_prize_id IS NULL` AND same raffle)
 *
 * Sorted by score DESC so the organiser sees the natural order.
 */
export async function listParticipantsForPrize(prizeId: number) {
  /* 1 . Find the raffle the prize belongs to ------------------------ */
  const prize = await db
    .select({ merch_raffle_id: eventMerchPrizes.merch_raffle_id })
    .from(eventMerchPrizes)
    .where(eq(eventMerchPrizes.merch_prize_id, prizeId))
    .limit(1)
    .then((r) => r[0]);

  if (!prize) return []; // prize vanished – return empty list

  /* 2 . Pull every relevant result row + user profile -------------- */
  return db
    .select({
      id: eventMerchPrizeResults.id,
      user_id: eventMerchPrizeResults.user_id,
      score: eventMerchPrizeResults.score,
      rank: eventMerchPrizeResults.rank,
      status: eventMerchPrizeResults.status,

      /* profile bits */
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      photo_url: users.photo_url,

      /* shipping fields – may be null */
      full_name: eventMerchPrizeResults.full_name,
      shipping_address: eventMerchPrizeResults.shipping_address,
      zip_code: eventMerchPrizeResults.zip_code,
      phone: eventMerchPrizeResults.phone,
    })
    .from(eventMerchPrizeResults)
    .innerJoin(users, eq(users.user_id, eventMerchPrizeResults.user_id))
    .where(
      or(
        eq(eventMerchPrizeResults.merch_prize_id, prizeId), // already assigned to this prize
        and(
          // or: un-assigned spin for same raffle
          isNull(eventMerchPrizeResults.merch_prize_id),
          eq(eventMerchPrizeResults.merch_raffle_id, prize.merch_raffle_id)
        )
      )
    )
    .orderBy(desc(eventMerchPrizeResults.score));
}

const eventMerchPrizeResultsDB = {
  addUserScore,
  computeTopN,
  getPrizeWithWinners,
  fetchUserRow,
  countParticipantsForMerchPrize,
  fetchUnassignedRow,
  fetchUnassignedScores,
  assignPrize,
  fetchRowByRaffleAndUser,
  fetchUnsentWinners,
  setNotifStatus,
  setContactInfo,
  listParticipantsForPrize,
  markPrizeShipped,
  markPrizeDelivered,
  markPrizeCollected,
  fetchResultWithPrizeAndEvent,
};
export default eventMerchPrizeResultsDB;
