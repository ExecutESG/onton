import { configProtected } from "@/server/config";
import { logger } from "@/server/utils/logger";
import { sleep } from "@/utils";
import { Bot, GrammyError } from "grammy";
import { userHasModerationAccess } from "@/db/modules/userFlags.db";
import eventDB from "@/db/modules/events.db";
import { handleApproveInit } from "./handlers/handleApproveInit";
import { handleApproveConfirm } from "./handlers/handleApproveConfirm";
import { handleApproveCancel } from "./handlers/handleApproveCancel";
import { handleSendNoticeCallback } from "./handlers/handleSendNoticeCallback";
import { handleCancelNoticeCallback } from "./handlers/handleCancelNoticeCallback";
import { handleRejectCustomCallback } from "./handlers/handleRejectCustomCallback";
import { handleCancelCustomReject } from "@/moderationBot/handlers/handleCancelCustomReject";
import { handleRejectReasonCallback } from "@/moderationBot/handlers/handleRejectReasonCallback";
import { handleRejectConfirm } from "@/moderationBot/handlers/handleRejectConfirm";
import { handleRejectCancel } from "@/moderationBot/handlers/handleRejectCancel";
import { pendingCustomReplyPrompts } from "@/moderationBot/types";
import { handleUpdateEventData } from "@/moderationBot/handlers/handleUpdateEventData";
import { handleCustomRejectText } from "@/moderationBot/handlers/handleCustomRejectText";
import { handleSendNoticeText } from "@/moderationBot/handlers/handleSendNoticeText";

export async function startBot() {
  while (true) {
    if (!configProtected?.bot_token_logs || !configProtected?.logs_group_id) {
      logger.error("Bot token or logs group ID not found in configProtected");
      logger.error("Retrying in 5 seconds...");
      await sleep(5000);
      continue;
    }

    const { bot_token_logs: BOT_TOKEN_LOGS } = configProtected;

    try {
      const bot = new Bot(BOT_TOKEN_LOGS);

      // =========== 1) Handle Inline Keyboard Callbacks ===========
      bot.on("callback_query:data", async (ctx) => {
        const payload = ctx.callbackQuery.data; // e.g. "approve_123abc", "rejectSpam_123abc" ...
        const originalCaption = ctx.update.callback_query.message?.caption || "";
        const modChatId = ctx.update.callback_query.message?.chat.id!;
        const modMessageId = ctx.update.callback_query.message?.message_id!;
        const userId = ctx.update.callback_query.from.id;

        // Basic user info for logging
        const fromUser = ctx.update.callback_query.from;
        const username = fromUser.username ? "@" + fromUser.username : "";
        const first_name = fromUser.first_name || "";
        const last_name = fromUser.last_name || "";
        const user_details = `\n<b>${first_name} ${last_name}</b> <code>${username}</code> <code>${userId}</code>`;

        // Verify user is a moderator
        if (!(await userHasModerationAccess(userId, "user"))) {
          await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
          return;
        }

        // parse payload
        const parts = payload.split("_");
        const action = parts[0];
        const eventUuid = parts[1];

        // Route to specialized handlers
        switch (action) {
          case "approve":
            await handleApproveInit(ctx, originalCaption, eventUuid);
            break;
          case "yesApprove":
            await handleApproveConfirm(ctx, userId, originalCaption, user_details, eventUuid);
            break;
          case "noApprove":
            await handleApproveCancel(ctx, originalCaption, eventUuid);
            break;

          case "sendNotice":
            await handleSendNoticeCallback(ctx, userId, originalCaption, eventUuid, modChatId, modMessageId);
            break;
          case "cancelNotice":
            if (parts.length === 3) {
              const promptId = Number(parts[1]);
              const evUuid = parts[2];
              await handleCancelNoticeCallback(ctx, userId, promptId, evUuid);
            }
            break;

          case "rejectCustom":
            await handleRejectCustomCallback(ctx, userId, originalCaption, eventUuid, modChatId, modMessageId);
            break;
          case "cancelCustom":
            if (parts.length === 3) {
              const promptId = Number(parts[1]);
              const evUuid = parts[2];
              await handleCancelCustomReject(ctx, userId, promptId, evUuid);
            }
            break;
          case "updateEventData":
            await handleUpdateEventData(ctx, originalCaption, eventUuid);
            break;
          default:
            // Maybe it's "rejectSpam", "rejectInappropriate", etc.
            if (action.startsWith("reject") && action !== "rejectCustom" && action !== "cancelCustom") {
              // e.g. "rejectSpam" => reasonKey = "Spam"
              const reasonKey = action.replace("reject", "");
              await handleRejectReasonCallback(ctx, originalCaption, eventUuid, reasonKey);
            } else if (action.startsWith("yesReject") && parts.length === 3) {
              const reasonKey = parts[1];
              const evId = parts[2];
              await handleRejectConfirm(ctx, userId, originalCaption, user_details, reasonKey, evId);
            } else if (action === "noReject") {
              await handleRejectCancel(ctx, originalCaption, eventUuid);
            } else {
              // unknown action
              await ctx.answerCallbackQuery({ text: "Unknown action" });
            }
            break;
        }
      });

      // =========== 2) Text Messages (for custom reject/notice) ===========
      bot.on("message:text", async (ctx) => {
        const replyTo = ctx.message.reply_to_message;
        if (!replyTo) return;

        const promptId = replyTo.message_id;
        if (!pendingCustomReplyPrompts.has(promptId)) {
          return;
        }

        const stored = pendingCustomReplyPrompts.get(promptId)!;
        const userId = ctx.from.id;

        // Only allow the same moderator
        if (userId !== stored.allowedUserId) {
          await ctx.reply("You are not the moderator who triggered this prompt!");
          return;
        }

        // remove from ephemeral map
        pendingCustomReplyPrompts.delete(promptId);

        // typed message
        const typedText = ctx.message.text;
        const eventData = await eventDB.selectEventByUuid(stored.eventUuid);

        // Decide which flow: reject or notice
        if (stored.type === "reject") {
          await handleCustomRejectText(ctx, userId, typedText, eventData, stored);
        } else if (stored.type === "notice") {
          await handleSendNoticeText(ctx, userId, typedText, eventData, stored);
        }
      });

      // =========== Start the Bot ===========
      await bot.start({ onStart: () => logger.log("Started moderation bot successfully.") });
      logger.log("Started The Moderation/Logger Bot Successfully");
      break;
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.error_code === 409) {
          // Bot is already running or conflict
          return;
        }
      }
      logger.error("Error while starting the bot. Retrying in 5 seconds...", error);
      await sleep(5000);
    }
  }
}

startBot().then(() => logger.log("startBot Function Finish ;"));
