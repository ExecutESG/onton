// db/modules/usersLinkedin.db.ts
import { db } from "@/db/db";
import { usersLinkedin, UsersLinkedinRow } from "@/db/schema/usersLinkedin";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

/* ------------------------------------------------------------------ */
/*                       Cache‑key helpers                            */
/* ------------------------------------------------------------------ */
const userLiCache = (userId: number) => `${redisTools.cacheKeys.userLinkedin}${userId}`;

const liUserCache = (liId: string) => `${redisTools.cacheKeys.userLinkedinById}${liId}`;

/* ------------------------------------------------------------------ */
/*                          CRUD functions                            */
/* ------------------------------------------------------------------ */

/** Insert or replace the LinkedIn account for a Telegram user */
async function upsertLinkedinAccount(params: {
  userId: number;
  liUserId: string;
  liFirstName?: string;
  liLastName?: string;
  liAvatarUrl?: string;
  liEmail?: string;
}) {
  const { userId, liUserId, liFirstName, liLastName, liAvatarUrl, liEmail } = params;

  try {
    // Enforce 1‑to‑1 mapping by deleting old row first
    await db.delete(usersLinkedin).where(eq(usersLinkedin.userId, userId)).execute();

    await db
      .insert(usersLinkedin)
      .values({
        userId,
        liUserId,
        liFirstName,
        liLastName,
        liAvatarUrl,
        liEmail,
      })
      .execute();

    await Promise.all([redisTools.deleteCache(userLiCache(userId)), redisTools.deleteCache(liUserCache(liUserId))]);
  } catch (err) {
    logger.error("upsertLinkedinAccount error", err);
    throw err;
  }
}

/** Read LinkedIn account by Telegram user‑id */
async function getLinkedinAccountByUserId(userId: number) {
  const cached = await redisTools.getCache(userLiCache(userId));
  if (cached) return cached as UsersLinkedinRow | null;

  const row = await db.select().from(usersLinkedin).where(eq(usersLinkedin.userId, userId)).execute();

  if (row.length) await redisTools.setCache(userLiCache(userId), row[0], redisTools.cacheLvl.medium);

  return row[0] ?? null;
}

/** Read Telegram user‑id by LinkedIn member‑id */
async function getUserIdByLiUserId(liUserId: string) {
  const cached = await redisTools.getCache(liUserCache(liUserId));
  if (cached) return cached as number | null;

  const row = await db
    .select({ userId: usersLinkedin.userId })
    .from(usersLinkedin)
    .where(eq(usersLinkedin.liUserId, liUserId))
    .execute();

  const result = row[0]?.userId ?? null;
  await redisTools.setCache(liUserCache(liUserId), result, redisTools.cacheLvl.medium);
  return result;
}

/** Delete the LinkedIn link (user disconnects) */
async function deleteLinkedinAccount(userId: number) {
  const account = await getLinkedinAccountByUserId(userId);

  await db.delete(usersLinkedin).where(eq(usersLinkedin.userId, userId)).execute();

  await Promise.all([
    redisTools.deleteCache(userLiCache(userId)),
    account?.liUserId ? redisTools.deleteCache(liUserCache(account.liUserId)) : Promise.resolve(),
  ]);
}

/* ------------------------------------------------------------------ */
/*                         Public export                              */
/* ------------------------------------------------------------------ */
export const usersLinkedinDB = {
  upsertLinkedinAccount,
  getLinkedinAccountByUserId,
  getUserIdByLiUserId,
  deleteLinkedinAccount,
};
