import { logger } from "@/server/utils/logger";
import { callCreateInviteLink, callCheckBotAdmin, sendTelegramMessage } from "@/lib/tgBot";
import eventDB from "@/db/modules/events.db";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";

/**
 * Issue a single-use Telegram group invite link for an approved attendee
 * and dispatch it via Telegram DM immediately.
 */
export async function issueAndSendEventInviteLink(
  eventUuid: string,
  userId: number,
  registrantId: number
): Promise<string | null> {
  try {
    const event = await eventDB.selectEventByUuid(eventUuid);
    if (!event || !event.eventTelegramGroup) {
      return null;
    }

    const chatId = event.eventTelegramGroup;
    const adminCheck = await callCheckBotAdmin(chatId);
    if (!adminCheck?.success) {
      logger.warn(`Bot is not admin in chat ${chatId} for event ${eventUuid}`);
      return null;
    }

    const createResult = await callCreateInviteLink(chatId, {
      creates_join_request: false,
      name: `Event_${eventUuid.slice(0, 8)}_User_${userId}`,
    });

    if (createResult?.success && createResult.invite_link) {
      const inviteLink = createResult.invite_link;
      await eventRegistrantsDB.setInviteLink(registrantId, inviteLink);

      const eventTitle = event.title || "the event";
      const customMessage =
        `🎉 <b>Your ticket for ${eventTitle} is confirmed!</b>\n\n` +
        `🔗 Here is your personal one-time invite link to join the official event chat:\n` +
        `<i>(Please keep this private—it is single-use for your ticket)</i>`;

      await sendTelegramMessage({
        chat_id: userId,
        message: customMessage,
        link: inviteLink,
        linkText: "💬 Join Event Chat",
      }).catch((err) => {
        logger.warn(`Could not send direct message to user ${userId}:`, err);
      });

      logger.log(`Generated and dispatched instant invite link for user ${userId} event ${eventUuid}`);
      return inviteLink;
    }
  } catch (error) {
    logger.error(`Error in issueAndSendEventInviteLink for event ${eventUuid} user ${userId}:`, error);
  }
  return null;
}
