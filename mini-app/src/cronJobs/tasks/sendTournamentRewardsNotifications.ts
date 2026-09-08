import { db } from "@/db/db";
import { gameLeaderboard } from "@/db/schema/gameLeaderboard";
import { eq, and, isNull, not } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { sendTelegramMessage } from "@/lib/tgBot";
import { tournaments } from "@/db/schema";
import { sleep } from "@/utils";

// This interface represents a row needing a reward notification.
interface RewardNotificationRow {
  telegramUserId: number; // the chat_id or user_id to send to
  tournamentId: number;
  rewardLink: string; // we can store the link or fetch it from the tournaments table
  tournamentName: string; // or any other info you want to send
}

export async function getParticipantsNeedingNotification(): Promise<RewardNotificationRow[]> {
  const rows = await db
    .select({
      telegramUserId: gameLeaderboard.telegramUserId,
      tournamentId: gameLeaderboard.tournamentId,
      rewardLink: tournaments.rewardLink,
      tournamentName: tournaments.name,
    })
    .from(gameLeaderboard)
    .innerJoin(tournaments, eq(gameLeaderboard.tournamentId, tournaments.id))
    .where(
      and(
        eq(gameLeaderboard.rewardCreated, true),
        eq(gameLeaderboard.notificationReceived, false),
        not(isNull(tournaments.rewardLink))
      )
    );

  return rows.map((r) => ({
    telegramUserId: r.telegramUserId,
    tournamentId: r.tournamentId,
    rewardLink: r.rewardLink ?? "",
    tournamentName: r.tournamentName ?? "",
  }));
}

/**
 * 2) The actual sending logic with up to 10 attempts * 3s delay if an error occurs.
 */
async function attemptSendTelegramWithRetries(row: RewardNotificationRow): Promise<boolean> {
  const messageText =
    `👋Hello! Here is your reward link for the tournament  "${row.tournamentName}".\n` +
    `Click below to claim:\n${row.rewardLink}`;

  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    try {
      logger.info(`Sending reward to user ${row.telegramUserId}, attempt #${attempts}`);
      // Our sendTelegramMessage usage => assuming signature: (args: { chat_id, message, linkText? })
      // Adjust to your actual function.
      const response = await sendTelegramMessage({
        chat_id: row.telegramUserId,
        message: messageText,
        link: row.rewardLink,
        linkText: "Claim your reward",
      });

      if (response.success) {
        logger.info(`Notification success for user ${row.telegramUserId}`);
        return true;
      } else {
        logger.warn(`Notification attempt #${attempts} failed for user ${row.telegramUserId}: ${response.error}`);
        // If error is fatal (user blocked bot, account deactivated/not found), stop retrying immediately
        const isFatal =
          response.error &&
          /blocked|forbidden|chat (?:not )?found|user (?:not )?found|deactivated/i.test(response.error);
        if (isFatal) {
          logger.warn(`User ${row.telegramUserId} has blocked the bot or is unreachable. Terminating retries.`);
          return false;
        }
      }
    } catch (error) {
      logger.error(`Notification attempt #${attempts} threw error for user ${row.telegramUserId} =>`, error);
    }

    // If we reached here, attempt failed => wait 200ms before next try
    if (attempts < 10) {
      await sleep(200);
    }
  }

  // If out of attempts
  logger.error(`All 10 attempts failed for user ${row.telegramUserId}`);
  return false;
}

/**
 * 3) Mark a user's notification as received in DB
 */
async function markNotificationReceived(telegramUserId: number, tournamentId: number) {
  // e.g.:
  await db
    .update(gameLeaderboard)
    .set({ notificationReceived: true })
    .where(and(eq(gameLeaderboard.telegramUserId, telegramUserId), eq(gameLeaderboard.tournamentId, tournamentId)));
}

/**
 * 4) Main “cron job” function
 *    - Finds all participants with rewardReceived=true, notificationReceived=false
 *    - Attempts up to 10 times to send each notification
 *    - If success, mark them “notificationReceived=true”
 */
export async function sendTournamentRewardsNotifications() {
  // Step a) Find participants who need a notification
  const needingNotice = await getParticipantsNeedingNotification();
  if (!needingNotice.length) {
    logger.info("No participants need reward notifications at this time.");
    return;
  }

  logger.info(`Found ${needingNotice.length} participants needing reward notifications.`);

  // Step b) For each participant:
  for (const row of needingNotice) {
    try {
      await sleep(50);
      const success = await attemptSendTelegramWithRetries(row);
      if (success) {
        // Mark the user’s notification as received
        await markNotificationReceived(row.telegramUserId, row.tournamentId);
      } else {
        // Retries exhausted or user blocked bot: mark as resolved to prevent infinite cron loops
        logger.warn(
          `Notification delivery permanently failed for user ${row.telegramUserId} in tournament ${row.tournamentId}. Marking resolved.`
        );
        await markNotificationReceived(row.telegramUserId, row.tournamentId);
      }
    } catch (err) {
      logger.error(`Unexpected error sending notification for user ${row.telegramUserId} =>`, err);
    }
  }
}
