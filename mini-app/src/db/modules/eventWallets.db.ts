// db/modules/eventWallets.db.ts
import { db } from "@/db/db";
import { eventWallets } from "@/db/schema/eventWallets";
import { events } from "@/db/schema/events";
import { InferSelectModel } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { decrypt } from "@/lib/cryptoHelpers"; // your decryption helper

/* -------------------------------------------------------------------------- */
/*                               CACHE HELPERS                                */
/* -------------------------------------------------------------------------- */
export const getWalletCacheKey = (eventId: number) => redisTools.cacheKeys.event_wallet_event_id + eventId;

/* -------------------------------------------------------------------------- */
/*                               TYPE EXPORTS                                 */
/* -------------------------------------------------------------------------- */
export type EventWalletRow = InferSelectModel<typeof eventWallets>;

/* -------------------------------------------------------------------------- */
/*                          LOW-LEVEL CRUD QUERIES                            */
/* -------------------------------------------------------------------------- */

/**
 * Insert a freshly generated TON wallet for an event.
 * @returns the inserted row
 */
export const insertEventWallet = async (values: {
  event_id: number;
  wallet_address: string;
  public_key?: string | null;
  mnemonic: string; // already encrypted!
}): Promise<EventWalletRow> => {
  const [row] = await db.insert(eventWallets).values(values).returning();
  // prime cache
  await redisTools.setCache(getWalletCacheKey(values.event_id), row, redisTools.cacheLvl.long);
  return row;
};

/**
 * Fetch wallet by event ID (with caching).
 * Returns the row with mnemonic **stripped** by default.
 * Set `includeMnemonic` to true to get the full row.
 */
export const fetchEventWalletByEventId = async (
  eventId: number,
  includeMnemonic = false
): Promise<EventWalletRow | null> => {
  const cached = await redisTools.getCache(getWalletCacheKey(eventId));
  if (cached) return includeMnemonic ? cached : omitMnemonic(cached);

  const row = (await db.select().from(eventWallets).where(eq(eventWallets.event_id, eventId)).execute()).pop();

  if (row) {
    await redisTools.setCache(getWalletCacheKey(eventId), row, redisTools.cacheLvl.long);
    return includeMnemonic ? row : omitMnemonic(row);
  }
  return null;
};

/**
 * Fetch wallet by TON address (no caching – keyed look-ups are rare).
 */
export const fetchEventWalletByAddress = async (
  address: string,
  includeMnemonic = false
): Promise<EventWalletRow | null> => {
  const row = (await db.select().from(eventWallets).where(eq(eventWallets.wallet_address, address)).execute()).pop();
  return row ? (includeMnemonic ? row : omitMnemonic(row)) : null;
};

/**
 * Update the **encrypted** mnemonic (or any other column).
 * Returns the updated row with mnemonic **stripped** by default.
 */
export const updateEventWallet = async (
  eventId: number,
  patch: Partial<Pick<EventWalletRow, "mnemonic" | "public_key" | "wallet_address">>,
  includeMnemonic = false
): Promise<EventWalletRow | null> => {
  const [row] = await db
    .update(eventWallets)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(eventWallets.event_id, eventId))
    .returning();

  // refresh cache
  if (row) {
    await redisTools.setCache(getWalletCacheKey(eventId), row, redisTools.cacheLvl.long);
    return includeMnemonic ? row : omitMnemonic(row);
  }
  return null;
};

/**
 * Hard-delete the wallet record (rare; cascades if the event is deleted).
 */
export const deleteEventWallet = async (eventId: number): Promise<void> => {
  await db.delete(eventWallets).where(eq(eventWallets.event_id, eventId)).execute();
  await redisTools.deleteCache(getWalletCacheKey(eventId));
};

/* -------------------------------------------------------------------------- */
/*                        HIGH-LEVEL / BUSINESS HELPERS                       */
/* -------------------------------------------------------------------------- */

/**
 * Convenience: create a wallet only if the event doesn’t have one yet.
 * Ensures 1-to-1 relationship and prevents duplicate rows.
 */
export const ensureEventWallet = async (args: {
  event_id: number;
  wallet_address: string;
  public_key?: string | null;
  mnemonic: string; // already encrypted
}) => {
  const existing = await fetchEventWalletByEventId(args.event_id, true);
  if (existing) return existing; // idempotent

  // extra sanity: event must exist and be enabled
  const eventExists = (
    await db
      .select({ id: events.event_id })
      .from(events)
      .where(and(eq(events.event_id, args.event_id), eq(events.enabled, true)))
      .execute()
  ).length;

  if (!eventExists) {
    throw new Error(`Event ${args.event_id} does not exist or is disabled.`);
  }

  logger.log(`Creating wallet for event ${args.event_id}: ${args.wallet_address}`);
  return await insertEventWallet(args);
};

/* -------------------------------------------------------------------------- */
/*                               UTIL HELPERS                                 */
/* -------------------------------------------------------------------------- */
function omitMnemonic(r: EventWalletRow): EventWalletRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mnemonic, ...rest } = r;
  // @ts-expect-error – remove column
  return rest;
}

/* fetch wallet + decrypted mnemonic in one go */
export const getWalletWithMnemonic = async (eventId: number) => {
  const row = await fetchEventWalletByEventId(eventId, true); // existing fn
  if (!row) return null;
  return {
    ...row,
    mnemonicWords: decrypt(row.mnemonic).split(" "), // 🔐  decrypt here
  };
};

/* -------------------------------------------------------------------------- */
/*                       MODULE PUBLIC API EXPORTS                            */
/* -------------------------------------------------------------------------- */
const eventWalletDB = {
  insertEventWallet,
  fetchEventWalletByEventId,
  fetchEventWalletByAddress,
  updateEventWallet,
  deleteEventWallet,
  ensureEventWallet,
  getWalletWithMnemonic,
};
export default eventWalletDB;
