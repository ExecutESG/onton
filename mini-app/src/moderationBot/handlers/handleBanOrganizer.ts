import eventDB from "@/db/modules/events.db";
import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";
import { getUserCacheKey } from "@/db/modules/users.db";
import { redisTools } from "@/lib/redisTools";

export const handleBanOrganizer = async (
  ctx: any,
  userId: number,
  originalCaption: string,
  user_details: string,
  organizerUserId: string | number,
  eventUuid: string
) => {
  try {
    const numOrgId = Number(organizerUserId);

    // 1) Mark user as banned in database
    await db
      .update(users)
      .set({
        role: "banned",
        updatedBy: `moderator_ban_${userId}`,
        updatedAt: new Date(),
      })
      .where(eq(users.user_id, numOrgId))
      .execute();

    // Invalidate user cache
    await redisTools.deleteCache(getUserCacheKey(numOrgId));

    // 2) Cascading takedown: hide and disable all events owned by this organizer
    const ownedEvents = await db
      .select({ uuid: events.event_uuid })
      .from(events)
      .where(eq(events.owner, numOrgId))
      .execute();

    await db
      .update(events)
      .set({
        hidden: true,
        enabled: false,
        updatedBy: `moderator_ban_${userId}`,
        updatedAt: new Date(),
      })
      .where(eq(events.owner, numOrgId))
      .execute();

    // Flush cache for all owned events
    for (const ev of ownedEvents) {
      if (ev.uuid) {
        await eventDB.deleteEventCache(ev.uuid);
      }
    }

    // 3) Insert audit log
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: numOrgId,
      action: "REJECT",
      customText: `BAN: Organizer banned and all ${ownedEvents.length} owned events delisted`,
    });

    // 4) Notify organizer
    try {
      await sendTelegramMessage({
        chat_id: numOrgId,
        message: `⛔ <b>Account Suspended:</b> Your ONTON organizer privileges have been permanently revoked due to community trust & safety violations.\n\nAll your events have been delisted.`,
      });
    } catch (err) {
      logger.warn(`Failed to notify banned organizer ${organizerUserId}:`, err);
    }

    // 5) Update Telegram message
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const newCaption = `${originalCaption}\n\nStatus: 🔨 <b>Organizer Banned & ${ownedEvents.length} Events Delisted By</b> ${user_details}\n🕒 <i>${timestampStr}</i>`;

    await ctx.editMessageCaption({
      caption: newCaption,
      parse_mode: "HTML",
    });

    await ctx.answerCallbackQuery({
      text: `🔨 Organizer banned. ${ownedEvents.length} events taken down.`,
      show_alert: true,
    });
  } catch (error) {
    logger.error(`handleBanOrganizer error for organizer ${organizerUserId}:`, error);
    await ctx.answerCallbackQuery({ text: "Error banning organizer" });
  }
};
