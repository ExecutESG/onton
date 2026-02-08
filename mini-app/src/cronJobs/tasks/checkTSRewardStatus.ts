import rewardDB from "@/db/modules/rewards.db";
import pLimit from "p-limit";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { handleSingleRewardUpdate } from "@/cronJobs/helper/handleSingleRewardUpdate";
import eventPaymentDB from "@/db/modules/eventPayment.db";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { sleep } from "@/utils";

const EVENTS_BATCH_SIZE = 50;
const REWARDS_BATCH_SIZE = 30;
const MAX_CONCURRENT_API_CALLS = 3;

/**
 * Main function to sync Ton Society status in a large-scale manner,
 * with batching & concurrency limiting, optionally filtering by start_date.
 *
 * @param startDateCutoff Optional minimum start_date (epoch seconds).
 *   If > 0, only events whose start_date is greater than this are processed.
 *   Otherwise, all events with a non-null activity_id are processed.
 */
export const syncTonSocietyStatusLargeScale = async (startDateCutoff: number = 0) => {
  try {
    let offset = 0;
    let totalEventsProcessed = 0;

    while (true) {
      // 1) If a startDateCutoff is provided, fetch only events with start_date > cutoff
      //    Otherwise, fetch all events that have a non-null activity_id.
      logger.log(`\nCheckSbtStatus: Fetching events with offset [offset: ${offset}]  startDateCutoff=${startDateCutoff}`);
      const eventChunk =
        startDateCutoff > 0
          ? await eventDB.fetchEventsWithNonNullActivityIdAfterStartDateDESC(EVENTS_BATCH_SIZE, offset, startDateCutoff)
          : await eventDB.fetchEventsWithNonNullActivityIdDESC(EVENTS_BATCH_SIZE, offset);

      if (eventChunk.length === 0) {
        logger.log("CheckSbtStatus: No more events with activity_id to process.");
        break;
      }

      for (const eventRow of eventChunk) {
        const { event_id, event_uuid, activity_id } = eventRow;
        logger.log(`\nCheckSbtStatus: [Event ${event_id}] Starting sync for activity_id=${activity_id}`);

        if (!activity_id) continue;
        logger.log(`CheckSbtStatus: [Event ${event_id}] Processing rewards for activity_id=${activity_id}`);
        let eventPaymentInfo: EventPaymentSelectType | undefined = undefined;
        if (eventRow.has_payment) {
          eventPaymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(event_uuid);
        }
        let rewardOffset = 0;
        while (true) {
          const rewardChunk = await rewardDB.fetchNotClaimedRewardsForEvent(event_uuid, REWARDS_BATCH_SIZE, rewardOffset);

          if (rewardChunk.length === 0) {
            logger.log(`CheckSbtStatus: [Event ${event_id}] No more rewards to process.`);
            break;
          }

          // Concurrency limiting
          const limit = pLimit(MAX_CONCURRENT_API_CALLS);
          logger.log(
            `CheckSbtStatus: [---Event ${event_id}] Processing ${rewardChunk.length} rewards [offset: ${rewardOffset}]`
          );
          const updatePromises = rewardChunk.map(({ reward_id, visitor_id }) =>
            limit(async () => {
              await handleSingleRewardUpdate(activity_id, visitor_id, event_id, "ton_society_sbt");
              if (eventPaymentInfo !== undefined && eventPaymentInfo?.ticketActivityId) {
                logger.log(
                  `CheckSbtStatus: [Event ${event_id}] Processing rewards for ticket with payment activity_id=${eventPaymentInfo.ticketActivityId}`
                );
                await handleSingleRewardUpdate(
                  eventPaymentInfo.ticketActivityId,
                  visitor_id,
                  event_id,
                  "ton_society_csbt_ticket"
                );
              }
              await sleep(300);
            })
          );
          logger.log(
            `CheckSbtStatus: [Event ${event_id}] Processing ${rewardChunk.length} rewards [offset: ${rewardOffset}]`
          );
          await Promise.all(updatePromises);

          logger.log(
            `CheckSbtStatus: [Event ${event_id}] Processed ${rewardChunk.length} rewards [offset: ${rewardOffset}]`
          );
          rewardOffset += REWARDS_BATCH_SIZE;
        }

        logger.log(`CheckSbtStatus: [Event ${event_id}] Done syncing rewards for activity_id=${activity_id}`);
      }

      offset += EVENTS_BATCH_SIZE;
      totalEventsProcessed += eventChunk.length;
      logger.log(`\nCheckSbtStatus: Processed ${eventChunk.length} events. Total so far: ${totalEventsProcessed}.`);
    }

    logger.log("CheckSbtStatus: All events processed. Sync complete.");
  } catch (error) {
    logger.error("CheckSbtStatus: Error in syncTonSocietyStatusLargeScale:", error);
    throw error;
  }
};

/**
 * Wrapper function exposed as a cron job.
 */
export const CheckSbtStatus = async () => {
  // If you need a startDateCutoff other than 0, pass it here
  // set date to one month ago
  const startDateCutoff = Math.floor(new Date().getTime() / 1000) - 90 * 24 * 60 * 60;
  await syncTonSocietyStatusLargeScale(startDateCutoff);
};
