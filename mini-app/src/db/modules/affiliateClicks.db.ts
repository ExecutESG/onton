import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";
import { getRedisClient } from "@/lib/redisClient";
import { EnqueuedClick } from "@/types/EnqueuedClick";

/**
 * 1) Enqueue a single click into Redis, storing only linkHash & userId (and createdAt if needed).
 */
export const enqueueClick = async (linkHash: string, userId: number, createdAt?: number) => {
  try {
    const redisClient = await getRedisClient();
    const payload: EnqueuedClick = {
      linkHash,
      userId,
      createdAt: createdAt ?? Date.now(),
    };

    await redisClient.rPush(redisTools.rQueues.CLICK_QUEUE_KEY, JSON.stringify(payload));
    logger.log(`Enqueued click for linkHash=${linkHash}, userId=${userId}`);
  } catch (err) {
    logger.error("Error enqueueing affiliate click:", err);
    throw err;
  }
};

export const affiliateClicksDB = {
  enqueueClick,
};
