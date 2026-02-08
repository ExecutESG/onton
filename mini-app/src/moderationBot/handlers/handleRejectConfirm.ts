import eventDB from "@/db/modules/events.db";
import { parseRejectReason } from "@/moderationBot/menu";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { InlineKeyboard } from "grammy";
import { sendTelegramMessage } from "@/lib/tgBot";

export const handleRejectConfirm = async (
  ctx: any,
  userId: number,
  originalCaption: string,
  user_details: string,
  reasonKey: string,
  eventUuid: string
) => {
  const eventData = await eventDB.selectEventByUuid(eventUuid);
  if (eventData) {
    await sendTelegramMessage({
      chat_id: Number(eventData.owner),
      message: `❌Your Event <b>(${eventData.title})</b> Has Been Rejected.\nReason: ${parseRejectReason(reasonKey)}`,
    });
    // Insert log
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid,
      eventOwnerId: eventData.owner,
      action: "REJECT",
      customText: parseRejectReason(reasonKey),
    });
  }

  const newCap =
    originalCaption + "\n\nStatus : ❌ Rejected By " + user_details + `\nReason: ${parseRejectReason(reasonKey)}`;
  const repMarkup = new InlineKeyboard()
    .text("✅ Approve Rejected Event", `approve_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`)
    .row()
    .text("🔔 Send Notice", `sendNotice_${eventUuid}`);

  await ctx.editMessageCaption({
    caption: newCap,
    parse_mode: "HTML",
    reply_markup: repMarkup,
  });
  await ctx.answerCallbackQuery({ text: "Event rejected!" });
};
