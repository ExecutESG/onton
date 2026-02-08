import { logger } from "@/server/utils/logger";
// DB & Models
import eventDB from "@/db/modules/events.db";
import rewardDB from "@/db/modules/rewards.db";
// Helpers
import { extendEndDateIfNeeded, processRewardsBatch, revertEndDateIfNeeded } from "@/cronJobs/helper/createRewards.helpers";
// Types
import { RewardVisitorTypePartial } from "@/db/schema/rewards";
import eventPaymentDB from "@/db/modules/eventPayment.db";

// ---------------------------------------------------------------------
// MAIN: createRewards
// ---------------------------------------------------------------------
/**
 * Create Rewards in order of event-end-date (descending) but in chunked batches per event.
 * If an event has already ended, set its end_date to (now + 1 day) on Ton Society before
 * creating rewards, then revert it back to the original date when done.
 */
export const CreateRewards = async (pushLockTTl: () => any) => {
  // 1) Gather all events that have pending rewards, sorted by event_end_date DESC
  const eventsWithPending = await eventDB.fetchEventsWithPendingRewards();
  // e.g. => { eventUuid: string, eventEndDate: number }[]

  const resultPerPage = 350000; //  ton society limit for create rewards with csv

  // 2) For each event (descending by end_date), process rewards in chunks
  for (const evt of eventsWithPending) {
    const localEvent = await eventDB.fetchEventByUuid(evt.eventUuid);

    if (!localEvent || !localEvent.activity_id) {
      logger.warn(`Event ${evt.eventUuid} missing local record or activity_id, skipping reward creation...`);
      continue;
    }
    logger.info(`Processing rewards for event ${evt.eventUuid} with title "${localEvent.title}"`);
    const now = Math.floor(Date.now() / 1000);
    const extendedEndDate = now + 86400; // +1 day from now

    // Extend end date if event ended
    let didExtend = false;
    try {
      didExtend = await extendEndDateIfNeeded(localEvent, extendedEndDate);
    } catch (err) {
      logger.error(`Failed to extend end_date on Ton Society for event ${evt.eventUuid}`, err);
      // If we can't extend the date (and the event was ended), skip creating rewards
      continue;
    }

    try {
      let offset = 0;
      let pendingRewards: RewardVisitorTypePartial[] = [];

      // fetch CSBT Tickets SBT
      const paymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(localEvent.event_uuid);
      if (paymentInfo && paymentInfo.ticket_type === "TSCSBT") {
        do {
          // Fetch up to pending rewards for this specific event
          pendingRewards = await rewardDB.fetchPendingRewardsForEvent(
            evt.eventUuid,
            "ton_society_csbt_ticket",
            resultPerPage,
            offset
          );
          if (pendingRewards.length === 0) {
            break;
          }
          if (!paymentInfo.ticketActivityId) {
            logger.error(
              `WTF: CSBT TICKET No activity_id found for event ${evt.eventUuid} with paymentInfo ${JSON.stringify(paymentInfo)}`
            );
            break;
          }
          offset += pendingRewards.length;
          // Process them in parallel
          await processRewardsBatch(pendingRewards, paymentInfo.ticketActivityId);
        } while (pendingRewards.length === resultPerPage);
      }

      // fetch normal sbt rewards
      do {
        //  Fetch up to pending rewards for this specific event
        pendingRewards = await rewardDB.fetchPendingRewardsForEvent(evt.eventUuid, "ton_society_sbt", resultPerPage, offset);
        if (pendingRewards.length === 0) {
          break;
        }
        offset += pendingRewards.length;
        // Process them in parallel
        await processRewardsBatch(pendingRewards, localEvent.activity_id);
      } while (pendingRewards.length === resultPerPage);

      if (pushLockTTl) {
        await pushLockTTl(); // extend lock or TTL if needed
      }
    } finally {
      // 5) If we extended the end date, revert it
      if (didExtend) {
        try {
          await revertEndDateIfNeeded(localEvent);
        } catch (err) {
          logger.error(`Failed to revert end_date on Ton Society for event ${evt.eventUuid}`, err);
        }
      }
    }
  }
};
