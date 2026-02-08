import { db } from "@/db/db";
import {
  partnershipAffiliatePurchases,
  PartnershipAffiliatePurchasesRow,
  PartnershipAffiliateUserEntryType,
} from "@/db/schema/partnershipAffiliatePurchases";
import { eq, sql, desc } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/* ------------------------------------------------------------------ *
 *   INSERT                                                           *
 * ------------------------------------------------------------------ */

/**
 * Record a purchase attributed to an affiliate link.
 */
export async function addPurchase(payload: {
  affiliateLinkId: number;
  walletAddress: string;
  telegramUserId: number;
  telegramUserName?: string | null;
  usdtAmount: string | number;
  onionAmount: string | number;
  userEntry: PartnershipAffiliateUserEntryType;
  /** Optional override – defaults to NOW() */
  timeOfBought?: Date;
}): Promise<PartnershipAffiliatePurchasesRow> {
  const [row] = await db
    .insert(partnershipAffiliatePurchases)
    .values({
      affiliateLinkId: payload.affiliateLinkId,
      walletAddress: payload.walletAddress,
      telegramUserId: payload.telegramUserId,
      telegramUserName: payload.telegramUserName ?? null,
      usdtAmount: payload.usdtAmount.toString(),
      onionAmount: payload.onionAmount.toString(),
      userEntry: payload.userEntry,
      timeOfBought: payload.timeOfBought ?? new Date(),
    })
    .returning()
    .execute();

  logger.info(
    `[PartnerPurchase:add] link #${payload.affiliateLinkId} → wallet ${payload.walletAddress} | USDT=${payload.usdtAmount}`
  );

  return row;
}

/* ------------------------------------------------------------------ *
 *   BASIC QUERIES                                                    *
 * ------------------------------------------------------------------ */

/** All purchases for a specific affiliate‑link ID */
export async function getPurchasesByLinkId(
  affiliateLinkId: number,
  { limit, offset }: { limit?: number; offset?: number } = {}
): Promise<PartnershipAffiliatePurchasesRow[]> {
  return db
    .select()
    .from(partnershipAffiliatePurchases)
    .where(eq(partnershipAffiliatePurchases.affiliateLinkId, affiliateLinkId))
    .orderBy(desc(partnershipAffiliatePurchases.timeOfBought))
    .limit(limit ?? 100)
    .offset(offset ?? 0)
    .execute();
}

/** All purchases made by a Telegram user (across all links) */
export async function getPurchasesByTelegramUserId(telegramUserId: number, opts: { limit?: number; offset?: number } = {}) {
  return db
    .select()
    .from(partnershipAffiliatePurchases)
    .where(eq(partnershipAffiliatePurchases.telegramUserId, telegramUserId))
    .orderBy(desc(partnershipAffiliatePurchases.timeOfBought))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0)
    .execute();
}

/* ------------------------------------------------------------------ *
 *   AGGREGATION / STATS                                              *
 * ------------------------------------------------------------------ */

/** Sum of USDT + ONION amounts for one affiliate‑link ID */
export async function sumTotalsByLinkId(affiliateLinkId: number): Promise<{
  usdtTotal: string;
  onionTotal: string;
  purchaseCount: number;
}> {
  const [row] = await db
    .select({
      usdtTotal: sql<string>`COALESCE(SUM(${partnershipAffiliatePurchases.usdtAmount}), 0)`,
      onionTotal: sql<string>`COALESCE(SUM(${partnershipAffiliatePurchases.onionAmount}), 0)`,
      purchaseCount: sql<number>`COUNT(*)`,
    })
    .from(partnershipAffiliatePurchases)
    .where(eq(partnershipAffiliatePurchases.affiliateLinkId, affiliateLinkId))
    .execute();

  return row;
}

export async function getGlobalTotals() {
  const [row] = await db
    .select({
      onionTotal: sql<string>`COALESCE(SUM(${partnershipAffiliatePurchases.onionAmount}), 0)`,
      usdtTotal: sql<string>`COALESCE(SUM(${partnershipAffiliatePurchases.usdtAmount}), 0)`,
    })
    .from(partnershipAffiliatePurchases)
    .execute();

  return {
    onion: Number(row.onionTotal),
    usdt: Number(row.usdtTotal),
  };
}

/* ------------------------------------------------------------------ *
 *   EXPORT FACADE                                                    *
 * ------------------------------------------------------------------ */

export const partnershipAffiliatePurchasesDB = {
  addPurchase,
  getPurchasesByLinkId,

  getPurchasesByTelegramUserId,
  sumTotalsByLinkId,
  getGlobalTotals,
};
