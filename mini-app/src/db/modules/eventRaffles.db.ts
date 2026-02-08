import { db } from "@/db/db";
import { eventRaffles, RaffleStatusType } from "@/db/schema/eventRaffles";
import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { eventRaffleResults, eventWallets, users } from "../schema";
import { fetchTonBalance } from "@/lib/tonBalance";
import {
  CHUNK_SIZE_RAFFLE,
  DEPLOY_FEE_NANO,
  EXT_FEE_NANO,
  INT_FEE_NANO,
  SAFETY_FLOOR_NANO,
  STATE_FLIP_BUFFER_NANO,
  JETTON_TRANSFER_TON,
  JETTON_FORWARD_TON,
} from "@/constants";
import raffleTokensDB from "./raffleTokens.db";
import { fetchJettonBalance } from "@/lib/jettonBalance";
import { Address } from "@ton/core";

export type RaffleUpdatableFields = {
  top_n?: number;
  prize_pool_nanoton?: bigint;
  status?: RaffleStatusType;
  token_id?: number;
};
export const createRaffle = async (eventId: number, topN: number, tokenId: number) => {
  const [row] = await db
    .insert(eventRaffles)
    .values({
      raffle_uuid: uuidv4(),
      event_id: eventId,
      top_n: topN,
      token_id: tokenId,
    })
    .returning();
  return row;
};

/* update top_n and/or prize_pool */
export const updateRaffle = async (raffleId: number, fields: RaffleUpdatableFields) => {
  /* build a partial object only with keys that are actually provided */
  const patch: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (fields.top_n !== undefined) patch.top_n = fields.top_n;
  if (fields.prize_pool_nanoton !== undefined) patch.prize_pool_nanoton = fields.prize_pool_nanoton;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.token_id !== undefined) patch.token_id = fields.token_id;

  const [row] = await db.update(eventRaffles).set(patch).where(eq(eventRaffles.raffle_id, raffleId)).returning();

  return row;
};

export const fetchRaffleByUuid = async (uuid: string) =>
  (await db.select().from(eventRaffles).where(eq(eventRaffles.raffle_uuid, uuid))).pop();

export const fetchRaffleByEvent = async (eventId: number) =>
  (await db.select().from(eventRaffles).where(eq(eventRaffles.event_id, eventId))).pop();

export const setRaffleStatus = async (raffleId: number, status: RaffleStatusType) =>
  db.update(eventRaffles).set({ status }).where(eq(eventRaffles.raffle_id, raffleId)).execute();

export const setPrizePool = async (raffleId: number, nanoTon: bigint) =>
  db.update(eventRaffles).set({ prize_pool_nanoton: nanoTon }).where(eq(eventRaffles.raffle_id, raffleId)).execute();

export const getRaffleSummaryForOrganizer = async (raffle_uuid: string) => {
  const raffle = await fetchRaffleByUuid(raffle_uuid);
  if (!raffle) return null;

  const token = await raffleTokensDB.getTokenById(raffle.token_id);
  if (!token) return null;

  /* wallet address & on-chain balance ----------------------------------- */
  const walletRow = await db
    .select({ address: eventWallets.wallet_address })
    .from(eventWallets)
    .where(eq(eventWallets.event_id, raffle.event_id))
    .execute()
    .then((r) => r.pop());

  const tonBalanceNano: bigint = walletRow?.address ? await fetchTonBalance(walletRow.address) : BigInt(0);
  const walletNonBounceable = walletRow?.address
    ? (() => {
        try {
          return Address.parse(walletRow.address).toString({ bounceable: false, urlSafe: true });
        } catch {
          return walletRow.address;
        }
      })()
    : null;

  let tokenBalanceNano = tonBalanceNano;
  let tokenWalletAddress: string | null = walletRow?.address ?? null;

  if (!token.is_native) {
    if (walletRow?.address && token.master_address) {
      const probe = await fetchJettonBalance(walletRow.address, token.master_address);
      tokenBalanceNano = probe?.balance ?? BigInt(0);
      tokenWalletAddress = probe?.walletAddress ?? null;
    } else {
      tokenBalanceNano = BigInt(0);
      tokenWalletAddress = null;
    }
  }

  /* eligible users ------------------------------------------------------ */
  const eligibleRows = await db
    .select({
      user_id: eventRaffleResults.user_id,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      photo_url: users.photo_url,
      reward_nanoton: eventRaffleResults.reward_nanoton,
      tx_hash: eventRaffleResults.tx_hash,
      rank: eventRaffleResults.rank,
      score: eventRaffleResults.score,
      status: eventRaffleResults.status,
    })
    .from(eventRaffleResults)
    .innerJoin(users, eq(users.user_id, eventRaffleResults.user_id))
    .where(and(eq(eventRaffleResults.raffle_id, raffle.raffle_id))) // eq(eventRaffleResults.status, "eligible")
    .orderBy(desc(eventRaffleResults.score))
    .execute();

  const eligibleCount = eligibleRows.length;
  const perUserNano =
    raffle.prize_pool_nanoton && raffle.top_n ? raffle.prize_pool_nanoton / BigInt(raffle.top_n) : BigInt(0);

  const poolNano = BigInt(raffle.prize_pool_nanoton ?? 0);
  const batches = Math.ceil(raffle.top_n / CHUNK_SIZE_RAFFLE);
  const extFees = token.is_native ? EXT_FEE_NANO * BigInt(batches) : BigInt(0);
  const intFees = token.is_native ? INT_FEE_NANO * BigInt(raffle.top_n) : BigInt(0);
  const jettonFees = token.is_native ? BigInt(0) : (JETTON_TRANSFER_TON + JETTON_FORWARD_TON) * BigInt(raffle.top_n);
  const buffer = SAFETY_FLOOR_NANO + STATE_FLIP_BUFFER_NANO;
  const tonRequiredNano =
    DEPLOY_FEE_NANO +
    buffer +
    extFees +
    intFees +
    jettonFees +
    (token.is_native ? poolNano : BigInt(0));
  const tokenRequiredNano = poolNano;

  const effectiveTokenBalance = token.is_native ? tonBalanceNano : tokenBalanceNano;
  const tonSufficient = tonBalanceNano >= tonRequiredNano;
  const tokenSufficient = effectiveTokenBalance >= tokenRequiredNano;
  const funded = tonSufficient && tokenSufficient;

  if (!["distributing", "completed"].includes(raffle.status)) {
    if (funded && raffle.status === "waiting_funding") {
      await updateRaffle(raffle.raffle_id, { status: "funded" });
      raffle.status = "funded";
    }
    if (!funded && raffle.status === "funded") {
      await updateRaffle(raffle.raffle_id, { status: "waiting_funding" });
      raffle.status = "waiting_funding";
    }
  }

  return {
    raffle: {
      ...raffle,
      prize_pool_nanoton: raffle.prize_pool_nanoton?.toString(), // 👈
    },
    token: {
      token_id: token.token_id,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      master_address: token.master_address,
      is_native: token.is_native,
      logo_url: token.logo_url,
    },
    wallet: {
      address: walletNonBounceable ?? walletRow?.address ?? null,
      tonBalanceNano: tonBalanceNano.toString(),
      tokenBalanceNano: effectiveTokenBalance.toString(),
      tokenWalletAddress,
    },
    funding: {
      tonRequiredNano: tonRequiredNano.toString(),
      tokenRequiredNano: tokenRequiredNano.toString(),
      tonSufficient,
      tokenSufficient,
    },
    eligibleCount,
    perUserNano: perUserNano.toString(),
    winners: eligibleRows.map((w) => ({
      ...w,
      reward_nanoton: w.reward_nanoton ? w.reward_nanoton.toString() : null,
    })),
  };
};

/* ------------------------------------------------------------------ */
/*             STATUS UPDATE WHEN ORGANISER PRESSES “TRIGGER”         */
/* ------------------------------------------------------------------ */
export const triggerDistribution = async (raffle_id: number) => setRaffleStatus(raffle_id, "distributing");

export const listByStatus = (status: RaffleStatusType) =>
  db.select().from(eventRaffles).where(eq(eventRaffles.status, status)).execute();

/**
 * Create a raffle row if none exists for the event – or update the existing
 * row’s top_n / prize pool. Returns the resulting row either way.
 */
export const upsert = async (eventId: number, topN: number, prizeNano?: bigint, tokenId = 1) => {
  const existing = await fetchRaffleByEvent(eventId);
  if (!existing) {
    /* create ───────────────────────────────────────────── */
    const raffle = await createRaffle(eventId, topN, tokenId);
    if (prizeNano !== undefined) {
      await setPrizePool(raffle.raffle_id, prizeNano);
      raffle.prize_pool_nanoton = prizeNano;
    }
    raffle.token_id = tokenId;
    return raffle;
  }

  /* update ─────────────────────────────────────────────── */
  const patch: RaffleUpdatableFields = {};
  if (existing.top_n !== topN) patch.top_n = topN;
  if (prizeNano !== undefined) patch.prize_pool_nanoton = prizeNano;
  if (tokenId && existing.token_id !== tokenId) patch.token_id = tokenId;

  return Object.keys(patch).length ? updateRaffle(existing.raffle_id, patch) : existing;
};

/* CONVENIENCE: complete raffle in one call */
export const completeRaffle = (raffleId: number) => setRaffleStatus(raffleId, "completed");
const eventRafflesDB = {
  createRaffle,
  fetchRaffleByUuid,
  fetchRaffleByEvent,
  setRaffleStatus,
  setPrizePool,
  getRaffleSummaryForOrganizer,
  triggerDistribution,
  listByStatus,
  completeRaffle,
  updateRaffle,
  upsert,
};
export default eventRafflesDB;
