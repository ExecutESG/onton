import eventReportsDB from "@/db/modules/eventReports.db";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import eventDB from "@/db/modules/events.db";
import { logger } from "@/server/utils/logger";

export const handleDismissReport = async (
  ctx: any,
  userId: number,
  originalCaption: string,
  user_details: string,
  eventUuid: string
) => {
  try {
    const eventData = await eventDB.selectEventByUuid(eventUuid);

    // 1) Mark reports as dismissed in database
    await eventReportsDB.updateReportStatus(eventUuid, "dismissed");

    // 2) Insert audit log
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: Number(eventData?.owner || 0),
      action: "APPROVE",
      customText: "Community abuse report reviewed and dismissed by moderator",
    });

    // 3) Update Telegram message
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const newCaption = `${originalCaption}\n\nStatus: ✅ <b>Report Dismissed By</b> ${user_details}\n🕒 <i>${timestampStr}</i>`;

    await ctx.editMessageCaption({
      caption: newCaption,
      parse_mode: "HTML",
    });

    await ctx.answerCallbackQuery({ text: "Report dismissed!" });
  } catch (error) {
    logger.error(`handleDismissReport error for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error dismissing report" });
  }
};
