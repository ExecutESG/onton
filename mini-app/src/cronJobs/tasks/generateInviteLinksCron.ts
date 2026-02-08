import { logger } from "@/server/utils/logger";
import { callCreateInviteLink, callDeleteInviteLink, callCheckBotAdmin, sendTelegramMessage } from "@/lib/tgBot";

import { fetchUpcomingEventsWithGroup } from "@/db/modules/events.db";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import { sleep } from "@/utils";
import { AxiosError } from "axios";

/**
 * Cron job that:
 * 1) Finds upcoming events (start_date > now, have a telegram group)
 * 2) Checks if the bot is admin
 * 3) Revokes links for rejected users
 * 4) Creates invite links for approved/checkedin users who have none
 * 5) Sends a DM with the link to each user, then only updates DB if DM succeeded
 */
export const generateInviteLinksCron = async () => {
  try {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // 1) Fetch future events that have event_telegram_group AND start_date > now
    const upcomingEvents = await fetchUpcomingEventsWithGroup(nowInSeconds);

    if (!upcomingEvents.length) {
      logger.log("No upcoming events with telegram group. Nothing to do.");
      return;
    }

    for (const evt of upcomingEvents) {
      const chatId = evt.eventTelegramGroup; // The group ID
      if (!chatId) continue;

      const eventUuid = evt.event_uuid;
      const eventTitle = evt.title || "this event";

      // 2) Check if bot is admin
      let isAdmin = false;
      try {
        const adminCheckResult = await callCheckBotAdmin(chatId);
        if (adminCheckResult?.success) {
          isAdmin = true;
        }
      } catch (err) {
        logger.error(`Failed to check bot admin status for chatId ${chatId}, eventUuid ${eventUuid}:`, err);
      }

      if (!isAdmin) {
        logger.warn(`Bot is not admin in chat ${chatId}, skipping event ${eventUuid}.`);
        continue;
      }

      // 3) Revoke links for REJECTED users
      const rejectedUsersWithLink = await eventRegistrantsDB.fetchRejectedUsersWithLink(eventUuid);
      for (const reg of rejectedUsersWithLink) {
        const oldInviteLink = reg.telegram_invite_link!;
        try {
          const revokeResult = await callDeleteInviteLink(chatId, oldInviteLink);
          if (revokeResult.success) {
            await eventRegistrantsDB.clearInviteLink(reg.id);
            logger.log(`Revoked link for user_id=${reg.user_id} event=${eventUuid}`);
          }
        } catch (err) {
          logger.error(`Failed to revoke link for user_id=${reg.user_id} event=${eventUuid}:`, err);
        }
      }

      // 4) Create invite links for APPROVED/CHECKEDIN with no link
      const needInviteLink = await eventRegistrantsDB.fetchNeedInviteLink(eventUuid);

      for (const reg of needInviteLink) {
        // Skip if no user_id
        if (!reg.user_id) continue;

        try {
          // Create the invite link
          const createResult = await callCreateInviteLink(chatId, {
            creates_join_request: false,
            name: `Event_${eventUuid}_User_${reg.user_id}`,
          });

          if (createResult.success && createResult.invite_link) {
            // 5) Send a DM to the user with the link
            const userTelegramId = reg.user_id; // ensure this is the correct Telegram user ID
            const inviteLink = createResult.invite_link;
            const customMessage =
              `👋 Here is your invite link for <b>${eventTitle}</b>. \n` +
              `⚠️ This is a <u>one-time link</u>, so if someone else uses it, you won’t be able to join.\n` +
              `Please keep it private.`;

            const dmResult = await sendTelegramMessage({
              chat_id: userTelegramId,
              message: customMessage,
              link: inviteLink,
              linkText: "🔗 Join Group",
            });
            if (dmResult.success) {
              logger.log(`Sent DM to user_id=${reg.user_id} event=${eventUuid} with invite link. Link: ${inviteLink}`);
              await eventRegistrantsDB.setInviteLink(reg.id, inviteLink);
            }
            await sleep(200); // Sleep for 1 second to avoid rate limits
          }
        } catch (err) {
          logger.error(err);
          logger.error(`Failed to create link for user_id=${reg.user_id} event=${eventUuid}:`, err);
        }
      }
    }

    logger.log("generateInviteLinksCron completed.");
  } catch (error) {
    logger.error("Error in generateInviteLinksCron:", error);
  }
};
