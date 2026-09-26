import eventDB from "@/db/modules/events.db";
import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { eq } from "drizzle-orm";
import { tgBotPostPublishModerationMenu } from "@/moderationBot/menu";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";

export const handleRelistEvent = async (
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

    // 1) Re-enable and unhide event
    await db
      .update(events)
      .set({
        hidden: false,
        enabled: true,
        updatedBy: `moderator_relist_${userId}`,
        updatedAt: new Date(),
      })
      .where(eq(events.event_uuid, eventUuid))
      .execute();

    // 2) Clear cache
    await eventDB.deleteEventCache(eventUuid);

    // 3) Log action
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: eventData.owner,
      action: "APPROVE",
      customText: "Re-listed by platform moderator",
    });

    // 4) Notify organizer
    if (eventData.owner) {
      try {
        await sendTelegramMessage({
          chat_id: Number(eventData.owner),
          message: `✅ Your Event <b>(${eventData.title})</b> has been reviewed and re-listed. Attendees can now discover and register.`,
        });
      } catch (err) {
        logger.warn(`Failed to notify organizer ${eventData.owner} of relist:`, err);
      }
    }

    // 5) Update Telegram message
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const newCaption = `${originalCaption}\n\nStatus: ✅ <b>Re-listed By</b> ${user_details}\n🕒 <i>${timestampStr}</i>`;

    await ctx.editMessageCaption({
      caption: newCaption,
      parse_mode: "HTML",
      reply_markup: tgBotPostPublishModerationMenu(eventUuid, eventData.owner),
    });

    await ctx.answerCallbackQuery({ text: "Event re-listed!" });
  } catch (error) {
    logger.error(`handleRelistEvent error for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error re-listing event" });
  }
};
