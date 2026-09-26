import eventDB from "@/db/modules/events.db";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";

export const handleWarnOrganizer = async (
  ctx: any,
  userId: number,
  organizerUserId: string | number,
  eventUuid: string
) => {
  try {
    const eventData = await eventDB.selectEventByUuid(eventUuid);
    const title = eventData?.title || "your event";

    // 1) Send warning via Telegram DM
    await sendTelegramMessage({
      chat_id: Number(organizerUserId),
      message: `⚠️ <b>Moderation Notice:</b> Your event <b>(${title})</b> is under review for potential terms or guidelines violations.\n\nPlease review your event title, description, and links to ensure compliance with ONTON platform safety rules. Repeated flags may result in event delisting or organizer suspension.`,
    });

    // 2) Log warning
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: Number(organizerUserId),
      action: "NOTICE",
      customText: "WARN: Formal moderation warning sent via Telegram bot",
    });

    await ctx.answerCallbackQuery({
      text: "⚠️ Warning dispatched to organizer via DM",
      show_alert: true,
    });
  } catch (error) {
    logger.error(`handleWarnOrganizer error for user ${organizerUserId}:`, error);
    await ctx.answerCallbackQuery({ text: "Failed to send warning to organizer" });
  }
};
