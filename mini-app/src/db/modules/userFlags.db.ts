import { db } from "@/db/db";
import { user_custom_flags, userFlagsType } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "../../server/utils/logger";
import { redisTools } from "@/lib/redisTools";

export const getUserFlagsCacheKey = (flag: string, userId: number) =>
  `${redisTools.cacheKeys.user_flags}${userId}:flags:${flag}`;

export async function organizerTsVerified(user_id: number): Promise<boolean> {
  const cacheKey = getUserFlagsCacheKey("ton_society_verified", user_id);

  const cachedFlag = await redisTools.getCache(cacheKey);
  if (cachedFlag !== null && cachedFlag !== undefined) {
    return Boolean(cachedFlag);
  }
  const result = await db.query.user_custom_flags.findFirst({
    where: and(
      eq(user_custom_flags.user_id, user_id),
      eq(user_custom_flags.user_flag, "ton_society_verified"),
      eq(user_custom_flags.enabled, true)
    ),
  });

  logger.log(`organizerTsVerified_${user_id} result :`, result);

  const cache_value = result ? result : false;
  await redisTools.setCache(cacheKey, cache_value, redisTools.cacheLvl.medium);

  return Boolean(result?.value);
}

export async function checkUserCustomFlagBoolean(user_id: number, flag: userFlagsType): Promise<boolean> {
  const cacheKey = getUserFlagsCacheKey(flag, user_id);

  const cachedFlag = await redisTools.getCache(cacheKey);
  if (cachedFlag !== null && cachedFlag !== undefined) {
    return Boolean(cachedFlag.value);
  }
  const result = await db.query.user_custom_flags.findFirst({
    where: and(
      eq(user_custom_flags.user_id, user_id),
      eq(user_custom_flags.user_flag, flag),
      eq(user_custom_flags.enabled, true)
    ),
  });

  logger.log(`${flag}_${user_id} result :`, result);

  const cache_value = result ? result : false;
  await redisTools.setCache(cacheKey, cache_value, redisTools.cacheLvl.medium);
  if (result && result.value === "true") {
    return Boolean(result.value);
  }
  return false;
}

export async function userHasModerationAccess(user_id: number, user_role: string) {
  if (user_role === "admin") {
    return true; // faster response
  }

  const result = await db.query.user_custom_flags.findFirst({
    where: and(
      eq(user_custom_flags.user_id, user_id),
      eq(user_custom_flags.user_flag, "event_moderator"),
      eq(user_custom_flags.enabled, true)
    ),
  });
  if (!result) return false;
  if (result) {
    return Boolean(result.value);
  }
}

export const userFlagsDB = {
  organizerTsVerified,
  checkUserCustomFlagBoolean,
  userHasModerationAccess,
};
