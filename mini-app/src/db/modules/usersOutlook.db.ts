import { db } from "@/db/db";
import { usersOutlook, UsersOutlookRow, UsersOutlookInsert } from "@/db/schema/usersOutlook";
import { eq } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

/* ════════════════════════════════════════
   Cache‑key helpers
   ════════════════════════════════════════ */
const byUser = (u: number) => `${redisTools.cacheKeys.userOutlook}${u}`;
const byMsId = (id: string) => `${redisTools.cacheKeys.userOutlookByMsId}${id}`;

/* ════════════════════════════════════════
   1.  UPSERT  (one Outlook account ↔  one TG user)
   ════════════════════════════════════════ */
export async function upsertOutlookAccount(p: UsersOutlookInsert) {
  try {
    // enforce one‑to‑one: delete any previous mapping for this TG user
    await db.delete(usersOutlook).where(eq(usersOutlook.userId, p.userId)).execute();

    await db.insert(usersOutlook).values(p).execute();

    // invalidate both caches
    await Promise.all([redisTools.deleteCache(byUser(p.userId)), redisTools.deleteCache(byMsId(p.msUserId))]);
  } catch (err) {
    logger.error("usersOutlookDB.upsert error", err);
    throw err;
  }
}

/* ════════════════════════════════════════
   2.  READ  by Telegram user‑id
   ════════════════════════════════════════ */
export async function getOutlookAccountByUserId(userId: number): Promise<UsersOutlookRow | null> {
  const cached = await redisTools.getCache(byUser(userId));
  if (cached) return cached as UsersOutlookRow;

  const [row] = await db.select().from(usersOutlook).where(eq(usersOutlook.userId, userId)).execute();
  if (row) await redisTools.setCache(byUser(userId), row, redisTools.cacheLvl.medium);
  return row ?? null;
}

/* ════════════════════════════════════════
   3.  READ  by Microsoft Graph user‑id
   ════════════════════════════════════════ */
export async function getUserIdByMsUserId(msUserId: string): Promise<number | null> {
  const cached = await redisTools.getCache(byMsId(msUserId));
  if (cached !== undefined) return cached as number | null;

  const [row] = await db
    .select({ userId: usersOutlook.userId })
    .from(usersOutlook)
    .where(eq(usersOutlook.msUserId, msUserId))
    .execute();

  const result = row?.userId ?? null;
  await redisTools.setCache(byMsId(msUserId), result, redisTools.cacheLvl.medium);
  return result;
}

/* ════════════════════════════════════════
   4.  DELETE / unlink
   ════════════════════════════════════════ */
export async function deleteOutlookAccount(userId: number) {
  const existing = await getOutlookAccountByUserId(userId);
  await db.delete(usersOutlook).where(eq(usersOutlook.userId, userId)).execute();

  await Promise.all([
    redisTools.deleteCache(byUser(userId)),
    existing?.msUserId ? redisTools.deleteCache(byMsId(existing.msUserId)) : Promise.resolve(),
  ]);
}

/* ════════════════════════════════════════
   5.  Module export
   ════════════════════════════════════════ */
export const usersOutlookDB = {
  upsertOutlookAccount,
  getOutlookAccountByUserId,
  getUserIdByMsUserId,
  deleteOutlookAccount,
};
