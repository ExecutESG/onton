import crypto from "crypto";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { getErrorMessages } from "@/lib/error";
import { sendLogNotification } from "@/lib/tgBot";

const CACHE_TTL = 40_000;
const ERROR_ALERT_BURST_COOLDOWN_SECONDS = 60; // Max 1 alert per minute per cron job
const ERROR_ALERT_REPEAT_COOLDOWN_SECONDS = 15 * 60; // Max 1 alert per 15 minutes for identical error

interface CronErrorAlertState {
  firstSeenAt: number;
  count: number;
}

export const cronJobRunner = (fn: (_: () => any) => any) => {
  const name = fn.name; // Get function name automatically
  const cacheLockKey = redisTools.cacheKeys.cronJobLock + name;

  return async () => {
    const cronLock = await redisTools.getCache(redisTools.cacheKeys.cronJobLock + name);

    if (cronLock) {
      return;
    }

    await redisTools.setCache(redisTools.cacheKeys.cronJobLock + name, true, CACHE_TTL);

    async function pushLockTTl() {
      try {
        return await redisTools.setRedisKeyTTL(cacheLockKey, CACHE_TTL);
      } catch (error) {
        logger.error("REDIS_ERROR", getErrorMessages(error));
      }
    }

    try {
      await fn(pushLockTTl);
    } catch (err) {
      const errorStr = getErrorMessages(err).join(", ");
      logger.error(`Cron job ${name} error: ${errorStr} \n\n`, err);

      try {
        const errorHash = crypto.createHash("md5").update(errorStr).digest("hex").slice(0, 8);
        const burstKey = `cron_alert_burst:${name}`;
        const repeatKey = `cron_alert_repeat:${name}:${errorHash}`;

        const isBurstThrottled = Boolean(await redisTools.getCache(burstKey));
        const repeatState: CronErrorAlertState | undefined = await redisTools.getCache(repeatKey);

        if (isBurstThrottled || repeatState) {
          const currentCount = (repeatState?.count || 0) + 1;
          const remainingTtl = await redisTools.getRedisKeyTTL(repeatKey);
          const ttlToKeep = remainingTtl && remainingTtl > 0 ? remainingTtl : ERROR_ALERT_REPEAT_COOLDOWN_SECONDS;

          await redisTools.setCache(
            repeatKey,
            { firstSeenAt: repeatState?.firstSeenAt || Date.now(), count: currentCount },
            ttlToKeep
          );
          logger.warn(
            `[cronJobRunner] Suppressed repetitive alert for ${name} (count: ${currentCount}): ${errorStr}`
          );
        } else {
          // Set both burst (60s) and repeat (15m) cooldowns
          await redisTools.setCache(burstKey, true, ERROR_ALERT_BURST_COOLDOWN_SECONDS);
          await redisTools.setCache(
            repeatKey,
            { firstSeenAt: Date.now(), count: 1 },
            ERROR_ALERT_REPEAT_COOLDOWN_SECONDS
          );

          await sendLogNotification({
            message: `Cron job ${name} error: ${errorStr}`,
            topic: "system",
          });
        }
      } catch (alertError) {
        logger.error(`[cronJobRunner] Failed to manage alert rate-limiting for ${name}:`, alertError);
      }
    } finally {
      await redisTools.deleteCache(redisTools.cacheKeys.cronJobLock + name);
    }
  };
};
