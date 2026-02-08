import { RewardType, TonSocietyRegisterActivityT } from "@/types/event.types";
import { EventRow } from "@/db/schema/events";
import { timestampToIsoString } from "@/lib/DateAndTime";
import { z } from "zod";
import { logger } from "@/server/utils/logger";
import { createUserRewardLink, updateActivity } from "@/lib/ton-society-api";
import { findVisitorById } from "@/db/modules/visitors.db";
import eventDB from "@/db/modules/events.db";
import { AxiosError } from "axios";
import { sleep } from "@/utils";
import rewardDB, { markRewardsAsCreated } from "@/db/modules/rewards.db";
import eventPaymentDB from "@/db/modules/eventPayment.db";
import { RewardVisitorTypePartial } from "@/db/schema/rewards";
import { generateTelegramCsv } from "@/cronJobs/helper/generateTelegramCsv";
import { postTelegramCsvToTonSociety } from "@/cronJobs/helper/postTelegramCsvToTonSociety";

// ---------------------------------------------------------------------
// HELPER: Build the Ton Society Activity "draft" for updating
// ---------------------------------------------------------------------
/**
 * Builds the Ton Society update payload based on the local event and a chosen end date.
 */
export const buildTonSocietyEventDraft = (localEvent: EventRow, newEndDateSec: number): TonSocietyRegisterActivityT => {
  // Validate `localEvent.location` as a URL if present, otherwise default to "Online".
  const additional_info =
    z.string().url().safeParse(localEvent.location).success && localEvent.location ? localEvent.location : "Online";

  return {
    title: localEvent.title,
    subtitle: localEvent.subtitle,
    description: localEvent.description,
    hub_id: parseInt(localEvent.society_hub_id as string), // Make sure `society_hub.id` is a string
    start_date: timestampToIsoString(localEvent.start_date), // Convert start_date to ISO
    end_date: timestampToIsoString(newEndDateSec), // Convert the new end date to ISO
    additional_info,
    cta_button: {
      link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${localEvent.event_uuid}`,
      label: "Enter Event",
    },
  };
};

// ---------------------------------------------------------------------
// HELPER: Extend the event's end_date if it has already ended
// ---------------------------------------------------------------------
/**
 * If localEvent.end_date < now, update Ton Society so it ends at extendedEndDate (in UNIX seconds from now).
 * Returns `true` if extended, otherwise `false`.
 */
export const extendEndDateIfNeeded = async (localEvent: EventRow, extendedEndDate: number): Promise<boolean> => {
  const now = Math.floor(Date.now() / 1000);
  const originalEndDate = localEvent.end_date;

  if (originalEndDate < now) {
    // The event is in the past, so let's set it to extendedEndDate
    logger.log(`Extending end_date for activity_id=${localEvent.activity_id} from ${originalEndDate} to ${extendedEndDate}`);

    const updatePayload = buildTonSocietyEventDraft(localEvent, extendedEndDate);
    await updateActivity(updatePayload, localEvent.activity_id!!);

    return true; // We did extend
  }

  return false; // No need to extend
};

// ---------------------------------------------------------------------
// HELPER: Revert the event end_date if it was extended
// ---------------------------------------------------------------------
/**
 * Reverts the event on Ton Society to its original end_date (from localEvent).
 * Only call this if we actually extended it previously.
 */
export const revertEndDateIfNeeded = async (localEvent: EventRow) => {
  logger.log(`Reverting end_date for activity_id=${localEvent.activity_id} back to ${localEvent.end_date}`);

  const revertPayload = buildTonSocietyEventDraft(localEvent, localEvent.end_date);
  await updateActivity(revertPayload, localEvent.activity_id!!);
};

// ---------------------------------------------------------------------
// HELPER: Process Single Reward (retry logic)
// ---------------------------------------------------------------------

/**
 * Handles a single reward creation with retry/backoff logic.
 */
export const processSingleReward = async (pendingReward: RewardVisitorTypePartial): Promise<void> => {
  let attempts = 0;
  const maxAttempts = 3; // Retries for non-429 errors

  while (true) {
    // brief delay to avoid overwhelming the API
    await sleep(20);

    try {
      const visitor = await findVisitorById(pendingReward.visitorId);
      if (!visitor) {
        throw new Error(`Visitor ${pendingReward.visitorId} not found`);
      }

      const event = await eventDB.selectEventByUuid(visitor.event_uuid);
      if (!event) {
        throw new Error(`Event ${visitor.event_uuid} not found`);
      }
      let activity_id;
      if (pendingReward.type === "ton_society_sbt") {
        activity_id = event.activity_id;
      } else if (pendingReward.type === "ton_society_csbt_ticket") {
        const paymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(event.event_uuid);
        if (!paymentInfo) {
          logger.error("error event Does not have payment !!!", event.event_uuid);
          return;
        }
        activity_id = paymentInfo.ticketActivityId;
      }
      if (activity_id === undefined) {
        logger.error(`Activity id is undefined for event ${event.event_uuid}`);
      }
      const response = await createUserRewardLink(activity_id as number, {
        telegram_user_id: visitor.user_id as number,
        attributes: [{ trait_type: "Organizer", value: event.society_hub.name as string }],
      });

      await rewardDB.updateReward(pendingReward.rewardId, response.data.data);
      return; // success, exit the loop
    } catch (error) {
      // Handle HTTP 429 (rate limit)
      if (error instanceof AxiosError && error.response?.status === 429) {
        logger.warn(`Hit 429 rate limit for reward ${pendingReward.rewardId}, waiting 30s before retry...`);
        await sleep(30000); // wait 30s, then retry indefinitely on 429
      } else {
        // Other errors: retry up to maxAttempts
        attempts++;
        if (attempts < maxAttempts) {
          logger.warn(`Error (attempt #${attempts}) processing reward ${pendingReward.rewardId}, retrying...`);
          await sleep(1000);
        } else {
          // After final attempt, mark as failed
          logger.error(`Failed to process reward ${pendingReward.rewardId} after ${maxAttempts} attempts`, error);
          await rewardDB.handleRewardError(pendingReward, error);
          return; // give up on this reward
        }
      }
    }
  }
};

// ---------------------------------------------------------------------
// HELPER: Process Rewards in Parallel Chunks
// ---------------------------------------------------------------------

/**
 * Processes all pending rewards in a single batch.
 *  1) Gathers telegram IDs from `pendingRewards`.
 *  2) Generates a CSV.
 *  3) Posts once to Ton Society.
 *  4) On success, marks rewards as created (and updates them in DB).
 */
export const processRewardsBatch = async (pendingRewards: RewardVisitorTypePartial[], activityId: number) => {
  if (!pendingRewards.length) {
    logger.info("No pending rewards found; skipping batch process.");
    return;
  }

  try {
    // 1) Map to an array of { telegramId } objects
    const participants = pendingRewards.map((reward) => ({
      telegramId: reward.userId,
      // or `reward.visitorId` if that field is your actual telegram ID.
      // Just make sure it matches the ID you want to pass to Ton Society.
    }));

    // 2) Generate single CSV from these participants
    const csvBuffer = generateTelegramCsv(participants);

    // 3) Post to Ton Society
    const rewardLink = await postTelegramCsvToTonSociety(activityId, csvBuffer);
    if (!rewardLink) {
      logger.error(`Failed to create reward link, skipping mark-as-created. Activity ID: ${activityId}`);
      return;
    }

    // 4) Mark these rewards as created in DB
    await rewardDB.markRewardsAsCreated(
      pendingRewards.map((r) => r.rewardId),
      rewardLink
    );

    logger.info(
      `Successfully processed ${pendingRewards.length} rewards in a single batch. Link: ${rewardLink} for activityId: ${activityId}`
    );
  } catch (error) {
    logger.error("Error in processRewardsBatch:", error);
    // Decide if you want to rethrow or handle it here
  }
};
