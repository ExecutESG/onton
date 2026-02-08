import { getRedisClient } from "@/lib/redisClient";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { db } from "@/db/db";
import { affiliateClick } from "@/db/schema";
import { EnqueuedClick } from "@/types/EnqueuedClick";

/**
 * 2) Consume up to `batchSize` clicks from Redis, resolve each linkHash -> affiliateLink.id,
 *    batch-insert rows into `affiliate_click` (with affiliateLinkId),
 *    then update `affiliate_links.total_clicks`.
 *
 *    Run this function in a cron or worker (e.g., every minute).
 */
export const consumeClickBatch = async (batchSize = 1000) => {
  try {
    const redisClient = await getRedisClient();

    // We'll store final items for DB insert: { affiliateLinkId, userId, createdAt }
    const toInsert: {
      affiliateLinkId: number;
      userId: number;
      createdAt: Date;
    }[] = [];

    // We'll also track how many clicks per affiliateLinkId for total_clicks updates
    const incrementMap: Record<number, number> = {};

    // We'll keep a local memo from linkHash -> affiliateLinkId to avoid repeated DB calls
    const linkHashToIdCache: Record<string, number> = {};

    let countPopped = 0; // how many raw queue items we've popped

    for (let i = 0; i < batchSize; i++) {
      const raw = await redisClient.lPop(redisTools.rQueues.CLICK_QUEUE_KEY);
      if (!raw) break; // queue empty

      countPopped++;

      let parsed: EnqueuedClick;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        logger.error("Invalid JSON in affiliate_clicks_queue:", parseErr);
        continue; // skip
      }

      const { linkHash, userId, createdAt } = parsed;
      if (!linkHash || !userId) {
        // minimal validation
        continue;
      }

      // 1) Convert linkHash -> affiliateLinkId
      let affiliateLinkId = linkHashToIdCache[linkHash];
      if (!affiliateLinkId) {
        // Not in local cache => fetch from DB
        const linkRow = await affiliateLinksDB.getAffiliateLinkByHash(linkHash);
        if (!linkRow) {
          // No valid affiliate link => skip
          logger.warn(`No affiliate link found for hash="${linkHash}". Skipping click.`);
          continue;
        }
        affiliateLinkId = linkRow.id;
        // store in local cache
        linkHashToIdCache[linkHash] = affiliateLinkId;
      }

      // 2) Prepare a row for the `affiliate_click` table
      toInsert.push({
        affiliateLinkId,
        userId,
        createdAt: new Date(createdAt ?? Date.now()),
      });

      // 3) Track total clicks for aggregator
      incrementMap[affiliateLinkId] = (incrementMap[affiliateLinkId] || 0) + 1;
    }

    if (toInsert.length === 0) {
      logger.log(`No valid affiliate clicks to process. (popped ${countPopped} total)`);
      return;
    }

    logger.log(`Processing ${toInsert.length} valid affiliate clicks (popped=${countPopped}).`);

    // 4) Batch-insert into `affiliate_click`
    await db.insert(affiliateClick).values(toInsert).execute();
    logger.log(`Inserted ${toInsert.length} rows into affiliate_click table.`);

    // 5) For each affiliateLinkId, update affiliate_links.total_clicks
    const linkIds = Object.keys(incrementMap).map((x) => parseInt(x));
    for (const linkId of linkIds) {
      const count = incrementMap[linkId];
      // We'll increment total_clicks by `count`
      try {
        await affiliateLinksDB.incrementAffiliateClicksByLinkId(linkId, count);

        logger.log(`Updated total_clicks for linkId=${linkId} by +${count}`);
      } catch (err) {
        logger.error(`Error updating total_clicks for linkId=${linkId}`, err);
      }
    }

    logger.log(`Batch consume done: Inserted ${toInsert.length} clicks, updated ${linkIds.length} links.`);
  } catch (err) {
    logger.error("Error in consumeClickBatch:", err);
    throw err;
  }
};
