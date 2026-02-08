import { db } from "@/db/db";
import { eventRaffleResults } from "@/db/schema/eventRaffleResults";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import eventRafflesDB from "./eventRaffles.db";
import raffleTokensDB from "./raffleTokens.db";
import { users } from "@/db/schema";

/* ------------------------- INSERT USER SCORE ---------------------------- */
export const addUserScore = async (params: { raffle_id: number; user_id: number; score: number; wallet_address: string }) =>
  db.insert(eventRaffleResults).values(params).onConflictDoNothing().execute();

/* ------------------------- RANK & ELIGIBILITY -------------------------- */
export const computeTopN = async (raffleId: number, topN: number) => {
  // 1. rank by score DESC, id ASC (tie-breaker)
  const rows = await db
    .select()
    .from(eventRaffleResults)
    .where(eq(eventRaffleResults.raffle_id, raffleId))
    .orderBy(desc(eventRaffleResults.score), eventRaffleResults.id)
    .execute();

  // 2. update rank & status
  for (let i = 0; i < rows.length; i++) {
    const rank = i + 1;
    await db
      .update(eventRaffleResults)
      .set({
        rank,
        status: rank <= topN ? "eligible" : "pending",
      })
      .where(eq(eventRaffleResults.id, rows[i].id))
      .execute();
  }
};

/* --------------------------- PAYOUT HELPERS ---------------------------- */
export const fetchEligibleForPayout = (raffleId: number) =>
  db
    .select()
    .from(eventRaffleResults)
    .where(and(eq(eventRaffleResults.raffle_id, raffleId), eq(eventRaffleResults.status, "eligible")));

export const markPaid = (id: number, nanoTon: bigint, txHash: string) =>
  db
    .update(eventRaffleResults)
    .set({
      status: "paid",
      reward_nanoton: nanoTon,
      tx_hash: txHash,
    })
    .where(eq(eventRaffleResults.id, id))
    .execute();

export const markFailed = (id: number) =>
  db.update(eventRaffleResults).set({ status: "failed" }).where(eq(eventRaffleResults.id, id)).execute();

export const getUserView = async (raffle_uuid: string, user_id: number) => {
  /* 1) raffle row ---------------------------------------------------- */
  const raffle = await eventRafflesDB.fetchRaffleByUuid(raffle_uuid);
  if (!raffle) return null;

  const token = await raffleTokensDB.getTokenById(raffle.token_id);

  /* 2) user’s own result (if any) ----------------------------------- */
  const myRaw = (
    await db
      .select()
      .from(eventRaffleResults)
      .where(and(eq(eventRaffleResults.raffle_id, raffle.raffle_id), eq(eventRaffleResults.user_id, user_id)))
      .execute()
  ).pop();

  /* normalise: bigint ➜ string so JSON can handle it */
  const my = myRaw
    ? {
        ...myRaw,
        reward_nanoton: myRaw.reward_nanoton ? myRaw.reward_nanoton.toString() : null,
      }
    : null;

  /* 3) winners list (only after completed) -------------------------- */
  let winners: {
    rank: number | null;
    score: number | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    reward_nanoton: string | null;
    tx_hash: string | null;
  }[] = [];

  if (raffle.status === "completed") {
    const rows = await db
      .select({
        rank: eventRaffleResults.rank,
        score: eventRaffleResults.score,
        username: users.username,
        first_name: users.first_name,
        last_name: users.last_name,
        photo_url: users.photo_url,
        reward_nanoton: eventRaffleResults.reward_nanoton,
        tx_hash: eventRaffleResults.tx_hash,
      })
      .from(eventRaffleResults)
      .innerJoin(users, eq(users.user_id, eventRaffleResults.user_id))
      .where(and(eq(eventRaffleResults.raffle_id, raffle.raffle_id), eq(eventRaffleResults.status, "paid")))
      .orderBy(eventRaffleResults.rank)
      .execute();

    winners = rows.map((w) => ({
      ...w,
      reward_nanoton: w.reward_nanoton ? w.reward_nanoton.toString() : null,
    }));
  }

  /* 4) stringify bigint inside the raffle row too ------------------- */
  return {
    raffle: {
      ...raffle,
      prize_pool_nanoton: raffle.prize_pool_nanoton ? raffle.prize_pool_nanoton.toString() : undefined,
    },
    token: token
      ? {
          token_id: token.token_id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          master_address: token.master_address,
          is_native: token.is_native,
          logo_url: token.logo_url,
        }
      : null,
    my,
    winners,
  };
};
/* list all eligible winners (status = 'eligible') */
export const listEligible = (raffleId: number) =>
  db
    .select()
    .from(eventRaffleResults)
    .where(and(eq(eventRaffleResults.raffle_id, raffleId), eq(eventRaffleResults.status, "eligible")))
    .orderBy(eventRaffleResults.rank)
    .execute();

/* bulk-mark rows as paid */
export const markManyPaid = async (ids: number[], nanoTon: bigint, txHash: string) =>
  db
    .update(eventRaffleResults)
    .set({
      status: "paid",
      reward_nanoton: nanoTon,
      tx_hash: txHash,
    })
    .where(inArray(eventRaffleResults.id, ids))
    .execute();

export const fetchUserScore = async (raffleId: number, userId: number) =>
  db
    .select()
    .from(eventRaffleResults)
    .where(and(eq(eventRaffleResults.raffle_id, raffleId), eq(eventRaffleResults.user_id, userId)))
    .execute()
    .then((r) => r[0] ?? null);

export async function setEligibilityForRaffle(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0], // 🔸 transaction from caller
  raffleId: number,
  topN: number
) {
  /* lock all rows – nobody can change them while we work */
  const rows = await tx
    .select({
      id: eventRaffleResults.id,
      rank: eventRaffleResults.rank,
    })
    .from(eventRaffleResults)
    .where(eq(eventRaffleResults.raffle_id, raffleId))
    .for("update")
    .execute();

  const winners: number[] = [];
  const nonWinners: number[] = [];

  for (const r of rows) {
    // rank is computed already (NULL until you call computeTopN)
    if (r.rank !== null && r.rank <= topN) winners.push(r.id);
    else nonWinners.push(r.id);
  }

  if (winners.length) {
    await tx.update(eventRaffleResults).set({ status: "eligible" }).where(inArray(eventRaffleResults.id, winners)).execute();
  }

  if (nonWinners.length) {
    await tx
      .update(eventRaffleResults)
      .set({ status: "not_eligible" }) // ← change literal if you prefer
      .where(inArray(eventRaffleResults.id, nonWinners))
      .execute();
  }
}

/**
 * How many distinct score-rows are recorded for a TON raffle?
 * @returns number (0-n)
 */
export const countParticipantsForRaffle = async (
  raffleId: number,
  /* allow passing a transactional client */
  tx = db
): Promise<number> => {
  const [{ cnt }] = await tx
    .select({ cnt: sql<number>`count(*)` })
    .from(eventRaffleResults)
    .where(eq(eventRaffleResults.raffle_id, raffleId));

  return Number(cnt);
};
const eventRaffleResultsDB = {
  addUserScore,
  computeTopN,
  fetchEligibleForPayout,
  markPaid,
  markFailed,
  getUserView,
  listEligible,
  markManyPaid,
  fetchUserScore,
  setEligibilityForRaffle,
  countParticipantsForRaffle,
};
export default eventRaffleResultsDB;
