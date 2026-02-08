import { sleep } from "@/utils";
import eventDB from "@/db/modules/events.db";
import telegramService from "@/services/telegramService";
import rewardDB from "@/db/modules/rewards.db";
import { logger } from "@/server/utils/logger";
import { getErrorMessages } from "@/lib/error";
import { RewardVisitorTypePartial } from "@/db/schema/rewards";

async function sendRewardNotification(createdReward: RewardVisitorTypePartial) {
  try {
    const event = await eventDB.fetchEventByUuid(createdReward.eventUuid);
    const rewardDbData = await rewardDB.checkExistingReward(createdReward.visitorId);
    if (!event) throw new Error("Event not found");

    if (!rewardDbData) throw new Error("Reward data not found");

    await telegramService.sendRewardNotification(createdReward, event);
    await rewardDB.updateRewardStatus(createdReward.rewardId, "notified");
  } catch (error) {
    logger.error("Error sending reward notification:", error);
    logger.error("BOT_API_ERROR", getErrorMessages(error));
    await rewardDB.handleRewardError(createdReward, error);
  }
}

export const notifyUsersForRewards = async (pushLockTTl: () => any) => {
  const chunkSize = 10;
  let offset = 0;
  let createdRewards: RewardVisitorTypePartial[] = [];

  do {
    createdRewards = await rewardDB.fetchCreatedRewards(chunkSize, offset);

    offset += createdRewards.length;

    const notificationPromises = createdRewards.map((createdReward) => async () => {
      await sendRewardNotification(createdReward);
    });

    for (const notification of notificationPromises) {
      await notification();
    }
    if (pushLockTTl) await pushLockTTl();
    await sleep(1500);
  } while (createdRewards.length > 0);

  return offset;
};
