import { Address } from "@ton/core";
import tonCenter from "@/services/tonCenter";
import ms from "ms";
import { logger } from "@/server/utils/logger";

/* ------------------------------------------------------------------ */
/*    In-memory cache (simple Map; swap for Redis if you like)        */
/* ------------------------------------------------------------------ */
const TTL = ms("20s"); // change to taste
const cache = new Map<string, { bal: bigint; exp: number }>();

/* ------------------------------------------------------------------ */
/*                Public helper – returns nano-TON (bigint)           */
/* ------------------------------------------------------------------ */
export async function fetchTonBalance(address: string): Promise<bigint> {
  /* 1. Validate – throws if malformed */
  Address.parse(address);

  /* 2. Cache hit? */
  const hit = cache.get(address);
  if (hit && hit.exp > Date.now()) return hit.bal;
  logger.log(`[TON Balance] Cache miss for ${address}`);
  /* 3. Call v2 first (handles non-initialized wallets), fallback to v3 */
  let tonFloat: number;
  try {
    tonFloat = await tonCenter.getWalletInformationBalance(address);
  } catch (e) {
    logger.warn(`[TON Balance] v2 getWalletInformation failed, falling back to v3 accountStates. err=${e}`);
    tonFloat = await tonCenter.getAccountBalance(address); // e.g. 3.14159 TON
  }
  const nano = BigInt(Math.round(tonFloat * 1e9)); // 3141590000n

  /* 4. Store & return */
  cache.set(address, { bal: nano, exp: Date.now() + TTL });
  return nano;
}
