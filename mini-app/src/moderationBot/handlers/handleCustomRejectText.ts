import moderationLogDB from "@/db/modules/moderationLogger.db";
import { InlineKeyboard } from "grammy";
import { sendTelegramMessage } from "@/lib/tgBot";
import { PendingCustomReply } from "@/moderationBot/types";
import { replyToMsgId } from "@/moderationBot/helpers";

export const handleCustomRejectText = async (
  ctx: any,
  userId: number,
  typedText: string,
  eventData: any,
  stored: PendingCustomReply
) => {
  if (eventData) {
    await sendTelegramMessage({
      chat_id: Number(eventData.owner),
      message: `❌Your Event <b>(${eventData.title})</b> Has Been Rejected.\nReason: ${typedText}`,
    });
    await moderationLogDB.insertModerationLog({
      moderatorUserId: userId,
      eventUuid: stored.eventUuid,
      eventOwnerId: eventData.owner,
      action: "REJECT",
      customText: typedText,
    });
  }

  const first_name = ctx.from.first_name || "";
  const last_name = ctx.from.last_name || "";
  const username = ctx.from.username ? "@" + ctx.from.username : "";
  const user_details = `\n<b>${first_name} ${last_name}</b> <code>${username}</code> <code>${userId}</code>`;

  const newCap = stored.originalCaption + "\n\nStatus : ❌ Rejected By " + user_details + `\nReason: ${typedText}`;
  const repMarkup = new InlineKeyboard()
    .text("✅ Approve Rejected Event", `approve_${stored.eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${stored.eventUuid}`);

  await ctx.api.editMessageCaption(stored.modChatId, stored.modMessageId, {
    caption: newCap,
    parse_mode: "HTML",
    reply_markup: repMarkup,
  });

  await ctx.api.editMessageText(stored.modChatId, replyToMsgId(ctx), "Your custom rejection reason has been recorded.");
};
