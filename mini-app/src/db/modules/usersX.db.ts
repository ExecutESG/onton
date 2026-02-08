// db/modules/usersX.db.ts
import { db } from "@/db/db";
import { usersX, UsersXRow } from "@/db/schema/usersX";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

/* -------------------------------------------------- */
/*                    Cache helpers                   */
/* -------------------------------------------------- */
const userXCache = (userId: number) => `${redisTools.cacheKeys.userX}${userId}`;
const xUserCache = (xId: string) => `${redisTools.cacheKeys.userXByXId}${xId}`;

/* -------------------------------------------------- */
/*                   CRUD FUNCTIONS                   */
/* -------------------------------------------------- */

/** Insert or replace the X account for a Telegram user */
async function upsertXAccount(params: {
  userId: number;
  xUserId: string;
  xUsername: string;
  xDisplayName?: string;
  xProfileImageUrl?: string;
}) {
  const { userId, xUserId, xUsername, xDisplayName, xProfileImageUrl } = params;

  try {
    // 1) Delete existing mapping for this user (if you enforce 1‑to‑1)
    await db.delete(usersX).where(eq(usersX.userId, userId)).execute();

    // 2) Insert new row
    await db
      .insert(usersX)
      .values({
        userId,
        xUserId,
        xUsername,
        xDisplayName,
        xProfileImageUrl,
      })
      .execute();

    // 3) Invalidate cache
    await Promise.all([redisTools.deleteCache(userXCache(userId)), redisTools.deleteCache(xUserCache(xUserId))]);
  } catch (err) {
    logger.error("upsertXAccount error", err);
    throw err;
  }
}

/** Read by Telegram user‑id */
async function getXAccountByUserId(userId: number) {
  // try cache
  const cached = await redisTools.getCache(userXCache(userId));
  if (cached) return cached as Awaited<UsersXRow>;

  const row = await db.select().from(usersX).where(eq(usersX.userId, userId)).execute();
  if (row.length) await redisTools.setCache(userXCache(userId), row[0], redisTools.cacheLvl.medium);
  return row[0] ?? null;
}

/** Read by X (twitter) user‑id */
async function getUserIdByXUserId(xUserId: string) {
  const cached = await redisTools.getCache(xUserCache(xUserId));
  if (cached) return cached as number | null;

  const row = await db.select({ userId: usersX.userId }).from(usersX).where(eq(usersX.xUserId, xUserId)).execute();

  const result = row[0]?.userId ?? null;
  await redisTools.setCache(xUserCache(xUserId), result, redisTools.cacheLvl.medium);
  return result;
}

/** Delete link (e.g. user disconnects X) */
async function deleteXAccount(userId: number) {
  const account = await getXAccountByUserId(userId);
  await db.delete(usersX).where(eq(usersX.userId, userId)).execute();
  await Promise.all([
    redisTools.deleteCache(userXCache(userId)),
    account?.xUserId ? redisTools.deleteCache(xUserCache(account.xUserId)) : Promise.resolve(),
  ]);
}

export const usersXDB = {
  upsertXAccount,
  getXAccountByUserId,
  getUserIdByXUserId,
  deleteXAccount,
};
