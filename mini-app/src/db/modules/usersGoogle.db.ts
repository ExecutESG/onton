/* ------------------------------------------------------------------ */
/* CRUD helpers for `users_google`                                    */
/* ------------------------------------------------------------------ */

import { db } from "@/db/db";
import { usersGoogle, UsersGoogleRow } from "@/db/schema/usersGoogle";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

/* -------- cache‑key helpers -------------------------------------- */
const userGoogleCache = (userId: number) => `${redisTools.cacheKeys.userGoogle}${userId}`;
const googleUserCache = (gId: string) => `${redisTools.cacheKeys.userGoogleByGId}${gId}`;

/* -------- UPSERT -------------------------------------------------- */
async function upsertGoogleAccount(p: {
  userId: number;
  gUserId: string;
  gEmail?: string;
  gDisplayName?: string;
  gAvatarUrl?: string;
}) {
  try {
    /* enforce single‑Google‑per‑TG : delete old mapping first */
    await db.delete(usersGoogle).where(eq(usersGoogle.userId, p.userId)).execute();

    await db
      .insert(usersGoogle)
      .values({
        userId: p.userId,
        gUserId: p.gUserId,
        gEmail: p.gEmail,
        gDisplayName: p.gDisplayName,
        gAvatarUrl: p.gAvatarUrl,
      })
      .execute();

    /* invalidate cache */
    await Promise.all([
      redisTools.deleteCache(userGoogleCache(p.userId)),
      redisTools.deleteCache(googleUserCache(p.gUserId)),
    ]);
  } catch (err) {
    logger.error("upsertGoogleAccount error", err);
    throw err;
  }
}

/* -------- READ by TG‑user‑id ------------------------------------- */
async function getGoogleAccountByUserId(userId: number): Promise<UsersGoogleRow | null> {
  const cached = await redisTools.getCache(userGoogleCache(userId));
  if (cached) return cached as UsersGoogleRow;

  const rows = await db.select().from(usersGoogle).where(eq(usersGoogle.userId, userId)).execute();
  const row = rows[0] ?? null;

  if (row) await redisTools.setCache(userGoogleCache(userId), row, redisTools.cacheLvl.medium);
  return row;
}

/* -------- READ by Google “sub” id -------------------------------- */
async function getUserIdByGoogleUserId(gUserId: string): Promise<number | null> {
  const cached = await redisTools.getCache(googleUserCache(gUserId));
  if (cached !== undefined && cached !== null) return cached as number | null;

  const rows = await db
    .select({ userId: usersGoogle.userId })
    .from(usersGoogle)
    .where(eq(usersGoogle.gUserId, gUserId))
    .execute();

  const userId = rows[0]?.userId ?? null;
  await redisTools.setCache(googleUserCache(gUserId), userId, redisTools.cacheLvl.medium);
  return userId;
}

/* -------- DELETE (disconnect) ------------------------------------ */
async function deleteGoogleAccount(userId: number) {
  const account = await getGoogleAccountByUserId(userId);
  await db.delete(usersGoogle).where(eq(usersGoogle.userId, userId)).execute();

  await Promise.all([
    redisTools.deleteCache(userGoogleCache(userId)),
    account?.gUserId ? redisTools.deleteCache(googleUserCache(account.gUserId)) : Promise.resolve(),
  ]);
}

export const usersGoogleDB = {
  upsertGoogleAccount,
  getGoogleAccountByUserId,
  getUserIdByGoogleUserId,
  deleteGoogleAccount,
};
