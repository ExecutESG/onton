import eventDB from "@/db/modules/events.db";
import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { eq } from "drizzle-orm";
import { tgBotDelistedMenu } from "@/moderationBot/menu";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import eventReportsDB from "@/db/modules/eventReports.db";
import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";

export const handleDelistEvent = async (
  ctx: any,
  userId: number,
  originalCaption: string,
  user_details: string,
  eventUuid: string
) => {
  try {
    const eventData = await eventDB.selectEventByUuid(eventUuid);
    if (!eventData) {
      await ctx.answerCallbackQuery({ text: "Event not found" });
      return;
    }

    // 1) Mark event as hidden and disabled in database
    await db
      .update(events)
      .set({
        hidden: true,
        enabled: false,
        updatedBy: `moderator_${userId}`,
        updatedAt: new Date(),
      })
      .where(eq(events.event_uuid, eventUuid))
      .execute();

    // 2) Invalidate Redis event cache so discovery & attendee RSVPs fail immediately
    await eventDB.deleteEventCache(eventUuid);

    // 3) Mark any pending reports as delisted
    await eventReportsDB.updateReportStatus(eventUuid, "delisted");

    // 4) Insert audit log
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: eventData.owner,
      action: "REJECT",
      customText: "Delisted by platform moderator via reactive Trust & Safety action",
    });

    // 5) Notify the event organizer via bot
    if (eventData.owner) {
      try {
        await sendTelegramMessage({
          chat_id: Number(eventData.owner),
          message: `🚫 Your Event <b>(${eventData.title})</b> has been delisted by platform moderation.\n\nIf you believe this action was taken in error, please contact platform support.`,
        });
      } catch (err) {
        logger.warn(`Failed to notify organizer ${eventData.owner} of delist:`, err);
      }
    }

    // 6) Update message in moderation channel
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const newCaption = `${originalCaption}\n\nStatus: 🚫 <b>Delisted By</b> ${user_details}\n🕒 <i>${timestampStr}</i>`;

    await ctx.editMessageCaption({
      caption: newCaption,
      parse_mode: "HTML",
      reply_markup: tgBotDelistedMenu(eventUuid),
    });

    await ctx.answerCallbackQuery({ text: "Event successfully delisted!" });
  } catch (error) {
    logger.error(`handleDelistEvent error for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error delisting event" });
  }
};
