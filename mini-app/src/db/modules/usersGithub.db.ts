import { db } from "@/db/db";
import { usersGithub, UsersGithubRow } from "@/db/schema/usersGithub";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

/* ---------------------- cache key helpers ---------------------- */
const userGhCache = (u: number) => `${redisTools.cacheKeys.userGithub}${u}`;
const ghUserCache = (g: string) => `${redisTools.cacheKeys.userGithubById}${g}`;

/* ------------------------- CRUD funcs -------------------------- */
async function upsertGithubAccount(params: {
  userId: number;
  ghUserId: string;
  ghLogin: string;
  ghDisplayName?: string;
  ghAvatarUrl?: string;
}) {
  const { userId, ghUserId, ghLogin, ghDisplayName, ghAvatarUrl } = params;
  try {
    await db.delete(usersGithub).where(eq(usersGithub.userId, userId)).execute();

    await db
      .insert(usersGithub)
      .values({
        userId,
        ghUserId,
        ghLogin,
        ghDisplayName,
        ghAvatarUrl,
      })
      .execute();

    await Promise.all([redisTools.deleteCache(userGhCache(userId)), redisTools.deleteCache(ghUserCache(ghUserId))]);
  } catch (err) {
    logger.error("upsertGithubAccount error", err);
    throw err;
  }
}

async function getGithubAccountByUserId(userId: number) {
  const cached = await redisTools.getCache(userGhCache(userId));
  if (cached) return cached as UsersGithubRow | null;

  const row = await db.select().from(usersGithub).where(eq(usersGithub.userId, userId)).execute();

  if (row.length) await redisTools.setCache(userGhCache(userId), row[0], redisTools.cacheLvl.medium);
  return row[0] ?? null;
}

async function getUserIdByGhUserId(ghUserId: string) {
  const cached = await redisTools.getCache(ghUserCache(ghUserId));
  if (cached) return cached as number | null;

  const row = await db
    .select({ userId: usersGithub.userId })
    .from(usersGithub)
    .where(eq(usersGithub.ghUserId, ghUserId))
    .execute();

  const result = row[0]?.userId ?? null;
  await redisTools.setCache(ghUserCache(ghUserId), result, redisTools.cacheLvl.medium);
  return result;
}

async function deleteGithubAccount(userId: number) {
  const account = await getGithubAccountByUserId(userId);
  await db.delete(usersGithub).where(eq(usersGithub.userId, userId)).execute();
  await Promise.all([
    redisTools.deleteCache(userGhCache(userId)),
    account?.ghUserId ? redisTools.deleteCache(ghUserCache(account.ghUserId)) : Promise.resolve(),
  ]);
}

export const usersGithubDB = {
  upsertGithubAccount,
  getGithubAccountByUserId,
  getUserIdByGhUserId,
  deleteGithubAccount,
};
