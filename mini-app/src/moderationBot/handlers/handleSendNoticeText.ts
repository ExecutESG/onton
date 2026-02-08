import moderationLogDB from "@/db/modules/moderationLogger.db";
import { tgBotApprovedMenu } from "@/moderationBot/menu";
import { sendTelegramMessage } from "@/lib/tgBot";
import { PendingCustomReply } from "@/moderationBot/types";
import { getNoticeEmoji } from "@/moderationBot/helpers";

export const handleSendNoticeText = async (
  ctx: any,
  userId: number,
  typedText: string,
  eventData: any, // from eventDB.selectEventByUuid(...)
  stored: PendingCustomReply // ephemeral data from your map
) => {
  // 1) Insert the new notice row into moderation_log
  await moderationLogDB.insertModerationLog({
    moderatorUserId: userId,
    eventUuid: stored.eventUuid,
    eventOwnerId: eventData.owner,
    action: "NOTICE",
    customText: typedText,
  });

  // 2) Get the total notice count for this owner
  const totalNotices = await moderationLogDB.getNoticeCountForOwner(eventData.owner);

  // 3) Determine the circle color (⚪ / 🟡 / 🔴)
  const circleEmoji = getNoticeEmoji(totalNotices);

  // 4) Build the organizer-facing message
  const noticeMessage = `
🔔 <b>Notice from Moderator</b>
<b>Event:</b> ${eventData.title}

${circleEmoji} You currently have <b>${totalNotices}</b> notice(s).

${typedText}
`.trim();

  // 5) Send to the organizer
  await sendTelegramMessage({
    chat_id: Number(eventData.owner),
    message: noticeMessage,
  });

  // 6) Build the updated caption for the moderator
  const first_name = ctx.from.first_name || "";
  const last_name = ctx.from.last_name || "";
  const username = ctx.from.username ? "@" + ctx.from.username : "";
  const user_details = `\n<b>${first_name} ${last_name}</b> <code>${username}</code> <code>${userId}</code>`;

  // Include the event title in the moderator’s updated caption
  const newCap = `
${stored.originalCaption}

<b>Event:</b> ${eventData.title}

A notice was sent by ${user_details}
<b>Notice Text:</b> ${typedText}

${circleEmoji} This user now has <b>${totalNotices}</b> notice(s).
`.trim();

  // 7) Update the moderator's caption
  await ctx.api.editMessageCaption(stored.modChatId, stored.modMessageId, {
    caption: newCap,
    parse_mode: "HTML",
    // Keep your "Approved" menu so they can do more actions if needed
    reply_markup: tgBotApprovedMenu(stored.eventUuid),
  });

  // 8) Let the moderator know we're done
  const promptMessageId = ctx.message.reply_to_message?.message_id || 0;
  await ctx.api.editMessageText(stored.modChatId, promptMessageId, "Your notice has been delivered to the organizer.");
};
