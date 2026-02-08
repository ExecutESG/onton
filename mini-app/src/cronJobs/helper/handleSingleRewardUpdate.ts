import visitorsDB from "@/db/modules/visitors.db";
import { getSBTClaimedStatus } from "@/lib/ton-society-api";
import { RewardTonSocietyStatusType } from "@/db/schema/rewards";
import { logger } from "@/server/utils/logger";
import rewardDB from "@/db/modules/rewards.db";
import { maybeInsertUserScore } from "@/cronJobs/helper/maybeInsertUserScore";
import { informTonfestUserClaim } from "@/cronJobs/helper/informTonfestUserClaim";
import { RewardType } from "@/db/enum";

export type HandleSingleRewardUpdateResult = {
  success: boolean; // was the update successful?
  error: string | null; // any error message
  tonSocietyStatus: RewardTonSocietyStatusType | null; // final status we ended up with, e.g. "CLAIMED"
  userScore?: {
    user_point: number | null;
    organizer_point: number | null;
    error: string | null;
  };
  visitorId?: number | null; // the visitor ID we processed
};

export const handleSingleRewardUpdate = async (
  activity_id: number,
  visitor_id: number,
  event_id: number,
  rewardType: RewardType
): Promise<HandleSingleRewardUpdateResult> => {
  // 1. Validate input
  if (!activity_id || !visitor_id || !event_id || !rewardType) {
    const err = `CheckSbtStatus: [Event ${event_id}] Invalid input: activity_id=${activity_id}, visitor_id=${visitor_id}, event_id=${event_id}, rewardType=${rewardType}`;
    logger.error(err);
    return { success: false, error: err, tonSocietyStatus: null, visitorId: null };
  }

  // 2. Load visitor row
  const visitorRow = await visitorsDB.findVisitorById(visitor_id);
  if (!visitorRow) {
    const err = `CheckSbtStatus: [Event ${event_id}] Visitor not found (id=${visitor_id})`;
    logger.error(err);
    return { success: false, error: err, tonSocietyStatus: null, visitorId: null };
  }
  const userId = visitorRow.user_id;
  if (!userId) {
    const err = `[Event ${event_id}] Visitor row missing user_id (visitor_id=${visitor_id})`;
    logger.error(err);
    return { success: false, error: err, tonSocietyStatus: null, visitorId: null };
  }

  // 3. Check existing reward status in DB
  const rewardRow = await rewardDB.checkExistingRewardWithType(visitor_id, rewardType);
  const cachedStatus = rewardRow?.tonSocietyStatus as RewardTonSocietyStatusType | undefined;

  let finalStatus: RewardTonSocietyStatusType | null = null;

  if (cachedStatus === "CLAIMED" || cachedStatus === "RECEIVED") {
    // Already claimed locally; skip remote check
    finalStatus = cachedStatus;
    logger.log(`CheckSbtStatus: [Event ${event_id}] Reward already ${cachedStatus} in DB — skipping Ton-Society call`);
  } else {
    // 4. Fetch status from Ton Society
    const remote = await getSBTClaimedStatus(activity_id, userId);
    const tsStatus = remote?.status as RewardTonSocietyStatusType | undefined;

    if (!tsStatus || !["NOT_CLAIMED", "CLAIMED", "RECEIVED"].includes(tsStatus)) {
      const err = `CheckSbtStatus: [Event ${event_id}] userId=${userId} activity_id=${activity_id} returned invalid status from Ton Society: ${tsStatus}`;
      logger.warn(err);
      return { success: false, error: err, tonSocietyStatus: tsStatus ?? null, visitorId: visitor_id };
    }

    // 4a. Persist the new status
    await rewardDB.updateTonSocietyStatusByVisitorIdAndRewardType(visitor_id, tsStatus, rewardType);
    finalStatus = tsStatus;
  }

  // 5. Award points if status is CLAIMED or RECEIVED
  if (finalStatus === "CLAIMED" || finalStatus === "RECEIVED") {
    if (rewardType === "ton_society_sbt") {
      const userScore = await maybeInsertUserScore(userId, event_id);
      logger.log(`CheckSbtStatus: [Event ${event_id}] ssUser score: ${JSON.stringify(userScore)}`);
      return {
        success: true,
        error: null,
        tonSocietyStatus: finalStatus,
        userScore,
        visitorId: visitor_id,
      };
    }

    if (rewardType === "ton_society_csbt_ticket") {
      await informTonfestUserClaim(userId, event_id, finalStatus === "CLAIMED" ? "addSbtFromOnton" : "setSbtPending");
      return {
        success: true,
        error: null,
        tonSocietyStatus: finalStatus,
        visitorId: visitor_id,
      };
    }
  }

  // 6. Status is NOT_CLAIMED (or no points to add)
  return {
    success: true,
    error: null,
    tonSocietyStatus: finalStatus,
    visitorId: visitor_id,
  };
};
