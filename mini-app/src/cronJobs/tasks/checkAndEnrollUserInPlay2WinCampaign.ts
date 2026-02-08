import { db } from "@/db/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { gameLeaderboard, Play2WinCampaignType } from "@/db/schema";
import { tournaments } from "@/db/schema";
import { tokenCampaignOrders } from "@/db/schema";
import { play2winCampaigns } from "@/db/schema";

import { logger } from "@/server/utils/logger";
import { getCollectionById } from "@/db/modules/tokenCampaignNftCollections.db";
import { attemptSendTelegramWithRetries } from "@/cronJobs/helper/attemptSendTelegramWithRetries";
import {
  PLAY2WIN_CAMPAIGN_MIN_DATE,
  PLAY2WIN_CAMPAIGN_TARGET_GAME_ID,
  PLAY2WIN_DEFAULT_CAMPAIGN_TYPE,
  PLAY2WIN_DEFAULT_MIN_POINTS,
} from "@/constants";
// Constants per your requirements
const MIN_POINTS = PLAY2WIN_DEFAULT_MIN_POINTS;
const MIN_DATE = PLAY2WIN_CAMPAIGN_MIN_DATE;
const TARGET_GAME_ID = PLAY2WIN_CAMPAIGN_TARGET_GAME_ID;
const CAMPAIGN_TYPE: Play2WinCampaignType = PLAY2WIN_DEFAULT_CAMPAIGN_TYPE;

/**
 *  checkAndEnrollUserInPlay2WinCampaign:
 *  1) Gathers all users who are:
 *     - scoreboard-eligible (≥1500 points, gameId=1, tourney start >= 2025-04-14)
 *     - or order-eligible (have a completed order)
 *  2) Excludes those already in play2win_campaigns for the same campaignType
 *  3) Inserts them in batch.
 *  4) Sends each newly enrolled user a Telegram message about the NFT from collection #4.
 */
export async function checkAndEnrollUserInPlay2WinCampaign(): Promise<void> {
  // 1) Find scoreboard-eligible users
  const scoreboardEligible = await db
    .select({
      userId: gameLeaderboard.telegramUserId,
    })
    .from(gameLeaderboard)
    .innerJoin(tournaments, eq(gameLeaderboard.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournaments.gameId, TARGET_GAME_ID),
        gte(tournaments.startDate, MIN_DATE),
        eq(tournaments.prizeType, "Coin"),
        gte(gameLeaderboard.points, MIN_POINTS)
      )
    )
    .groupBy(gameLeaderboard.telegramUserId);
  // groupBy to ensure distinct user IDs if they have multiple rows

  // 2) Find order-eligible users
  // const orderEligible = await modules
  //   .select({
  //     userId: tokenCampaignOrders.userId,
  //   })
  //   .from(tokenCampaignOrders)
  //   .where(
  //     eq(tokenCampaignOrders.status, "completed") // or your final state for "completed"
  //   )
  //   .groupBy(tokenCampaignOrders.userId);
  // groupBy for distinct user IDs

  // Combine both sets
  const scoreboardSet = new Set(scoreboardEligible.map((row) => row.userId));
  // const orderSet = new Set(orderEligible.map((row) => row.userId));

  const allEligibleUserIds = new Set<number>([...scoreboardSet /*...orderSet*/]);

  if (allEligibleUserIds.size === 0) {
    logger.info("No new users found eligible for Play2Win campaign.");
    return;
  }

  // 3) Exclude users already in `play2win_campaigns` for this campaign
  const alreadyEnrolled = await db
    .select({
      userId: play2winCampaigns.userId,
    })
    .from(play2winCampaigns)
    .where(
      and(
        eq(play2winCampaigns.campaignType, CAMPAIGN_TYPE),
        inArray(play2winCampaigns.userId, Array.from(allEligibleUserIds))
      )
    );

  // Build a set of users who are already enrolled
  const alreadySet = new Set(alreadyEnrolled.map((r) => r.userId));

  // Filter out any already-enrolled from the final insertion list
  const newlyEligible = [...allEligibleUserIds].filter((uid) => !alreadySet.has(uid));

  if (newlyEligible.length === 0) {
    logger.info("All eligible users already enrolled in the Play2Win campaign.");
    return;
  }

  logger.info(`Found ${newlyEligible.length} new user(s) to enroll in the Play2Win campaign:`, newlyEligible);

  // 4) Insert them (batch) into `play2win_campaigns`
  const toInsert = newlyEligible.map((userId) => ({
    userId,
    campaignType: CAMPAIGN_TYPE,
  }));

  await db
    .insert(play2winCampaigns)
    .values(toInsert)
    .onConflictDoNothing({
      target: [play2winCampaigns.userId, play2winCampaigns.campaignType],
    });

  logger.info("Batch insertion into play2win_campaigns done.");

  // 5) Send each newly enrolled user the NFT message from collection #4
  const collection = await getCollectionById(4);
  if (!collection) {
    logger.warn("Collection ID=4 not found. Cannot send NFT message to newly enrolled users.");
    return;
  }

  // For demonstration: the same rewardLink + buttonText for all
  // In real code, you might generate a claim link per user
  const rewardLink = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_play2win_campaign`;
  const buttonText = "Claim Your NFT";

  // Send a message to each newly-enrolled user
  for (const uid of newlyEligible) {
    const messageText = `💥 Congratulations\n Your Play2Win NFT reserved to be minted because you reached the threshold in sweet Rush tournament .`;
    const rowForSend = {
      telegramUserId: String(uid), // if the actual Telegram chat_id differs, you'll need to map it
      rewardLink,
      buttonText,
    };

    await attemptSendTelegramWithRetries(rowForSend, messageText);
  }

  logger.info("Completed notifying all newly enrolled users for Play2Win campaign.");
}
