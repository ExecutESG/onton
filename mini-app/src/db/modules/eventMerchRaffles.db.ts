/* db/modules/eventMerchRaffles.db.ts
   ─────────────────────────────────────────────────────────── */
import { db } from "@/db/db";
import { eventMerchRaffles } from "@/db/schema/eventMerchRaffles";
import { eventMerchPrizes } from "@/db/schema/eventMerchPrizes";
import { eventMerchPrizeResults } from "@/db/schema/eventMerchPrizeResults";
import { users } from "@/db/schema/users";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/* ------------------------------------------------------------------ */
/*                        LOW-LEVEL HELPERS                           */
/* ------------------------------------------------------------------ */

/** Create a merch-raffle directly for an event (1-per-event) */
export const createForEvent = async (eventId: number) => {
  const [row] = await db
    .insert(eventMerchRaffles)
    .values({
      eventId, // ← NEW — no more parent raffle
      merchRaffleUuid: uuidv4(),
    })
    .returning();

  return row;
};

export const fetchByEvent = async (eventId: number) => {
  const [row] = await db.select().from(eventMerchRaffles).where(eq(eventMerchRaffles.eventId, eventId)).limit(1);

  return row ?? null;
};

export const fetchMerchRaffleByUuid = async (uuid: string) => {
  const [row] = await db.select().from(eventMerchRaffles).where(eq(eventMerchRaffles.merchRaffleUuid, uuid)).limit(1);

  /* keep the old key for front-end compatibility, but always null */
  return row ? { ...row, parent_raffle_uuid: null } : undefined;
};

/* ------------------------------------------------------------------ */
/*                       ORGANISER SUMMARY                            */
/* ------------------------------------------------------------------ */

export const getMerchRaffleSummary = async (merchRaffleUuid: string) => {
  const raffle = await fetchMerchRaffleByUuid(merchRaffleUuid);
  if (!raffle) return null;

  /* 1️⃣  all prizes for this raffle */
  const prizes = await db
    .select()
    .from(eventMerchPrizes)
    .where(eq(eventMerchPrizes.merch_raffle_id, raffle.merchRaffleId))
    .execute();

  /* 2️⃣  attach winners to every prize */
  const prizeViews = await Promise.all(
    prizes.map(async (p) => {
      const winners = await db
        .select({
          user_id: eventMerchPrizeResults.user_id,
          score: eventMerchPrizeResults.score,
          rank: eventMerchPrizeResults.rank,
          status: eventMerchPrizeResults.status,
          full_name: eventMerchPrizeResults.full_name,
          shipping_address: eventMerchPrizeResults.shipping_address,
          phone: eventMerchPrizeResults.phone,
          tracking_number: eventMerchPrizeResults.tracking_number,
          username: users.username,
          first_name: users.first_name,
          last_name: users.last_name,
          photo_url: users.photo_url,
        })
        .from(eventMerchPrizeResults)
        .innerJoin(users, eq(users.user_id, eventMerchPrizeResults.user_id))
        .where(eq(eventMerchPrizeResults.merch_prize_id, p.merch_prize_id))
        .orderBy(eventMerchPrizeResults.rank, desc(eventMerchPrizeResults.score))
        .execute();

      return { prize: p, winners };
    })
  );

  return { raffle, prizes: prizeViews };
};

/* ------------------------------------------------------------------ */
/*                           EXPORT HUB                               */
/* ------------------------------------------------------------------ */
const eventMerchRafflesDB = {
  /* core */
  createForEvent,
  fetchByEvent,
  fetchMerchRaffleByUuid,
  /* dashboards */
  getMerchRaffleSummary,
};

export default eventMerchRafflesDB;
