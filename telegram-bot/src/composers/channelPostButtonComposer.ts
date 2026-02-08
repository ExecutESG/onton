import { Bot, Composer } from "grammy"
import { logger } from "../utils/logger"
import { z } from "zod"
import { isUserAdmin } from "../db/db"; // added admin check import
import { fetchOntonSetting } from "../db/ontonSettings"
import { isNewCommand } from "../helpers/isNewCommand"
import { MyContext } from "../types/MyContext"
import { isUrlValid } from "../utils/utils"

export const channelPostButtonComposer = new Composer<MyContext>();

/**
 * Global text handler:
 * - This will handle the user replies based on the current session step.
 */
channelPostButtonComposer.on("msg", async (ctx, next) => {
  if (isNewCommand(ctx)) {
    ctx.session = {};
    return next();
  }

  if (ctx.session.channelButtonStep === "askPostId") {
    await handleAskPostId(ctx);
    return;
  }

  if (ctx.session.channelButtonStep === "askLink") {
    await handleAskLink(ctx);
    return;
  }

  if (ctx.session.channelButtonStep === "askButtonText") {
    await handleAskButtonText(ctx);
    return;
  }
  
  if (ctx.session.channelButtonStep === "removeButton") {
    await handleRemoveButton(ctx);
    return;
  }
});

/* -------------------------------------------------------------------------- */
/*                             Handler Functions                              */
/* -------------------------------------------------------------------------- */

// New handler functions for step logic
async function handleAskPostId(ctx: MyContext) {
  // if the message is forwarded from a channel, copy its post id
  if (ctx.message.forward_origin?.type === 'channel') {
    const forwardedPostId = ctx.message.forward_origin.message_id;
    if (typeof forwardedPostId === 'number') {
      ctx.session.channelButtonPostId = forwardedPostId;
      ctx.session.channelButtonStep = "askLink";
      await ctx.reply("Post forwarded. Post ID copied. Now please send the link.");
      return;
    }
  }

  // fallback to using the text input if it's a valid number
  const trimmed = ctx.message.text.trim();
  if (/^\d+$/.test(trimmed)) {
    ctx.session.channelButtonPostId = Number(trimmed);
    ctx.session.channelButtonStep = "askLink";
    await ctx.reply("Post found. Now please send the link.");
  } else {
    await ctx.reply("❌ Please send a valid numeric post ID.");
  }
}

async function handleAskLink(ctx: MyContext) {
  const text = ctx.message.text.trim();
  const urlSchema = z.string().refine((v) => isUrlValid(v), {  message: "Url is invalid"});

  try {
    urlSchema.parse(text);
    ctx.session.channelButtonLink = text;
    ctx.session.channelButtonStep = "askButtonText";
    await ctx.reply("Link received. Now please send the button text.");
  } catch (error) {
    await ctx.reply("❌ The provided text is not a valid URL. Please try again.");
  }
}
async function handleAskButtonText(ctx: MyContext) {
  const buttonText = ctx.message.text.trim();
  const link = ctx.session.channelButtonLink;

  const { configProtected } = await fetchOntonSetting();
  const announcement_channel_id = configProtected['announcement_channel_id'];
  const announcementBotId = configProtected['check_join_bot_token'];

  if (!announcement_channel_id) {
    await ctx.reply("❌ Announcement channel ID is not configured. Please contact the administrator.");
    return;
  }

  const parsedChannelId = parseInt(announcement_channel_id);
  if (isNaN(parsedChannelId)) {
    await ctx.reply("❌ Invalid announcement channel ID. Please contact the administrator.");
    return;
  }

  const buttonBot = new Bot(announcementBotId);
  buttonBot.stop();

  const postId = ctx.session.channelButtonPostId as number;

  try {
    await buttonBot.api.editMessageReplyMarkup(parsedChannelId, postId, {
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url: link }]]
      }
    });
    await ctx.reply("✅ Post updated with the new inline button.");
  } catch (error) {
    logger.debug("Failed to update the post", { error });
    await ctx.reply("❌ Failed to update the post. Ensure the bot has enough rights in the channel.");
  }
  
  // Clear channel button session
  ctx.session.channelButtonStep = undefined;
  ctx.session.channelButtonPostId = undefined;
  ctx.session.channelButtonLink = undefined;
}

async function handleRemoveButton(ctx: MyContext) {
  const trimmed = ctx.message.text.trim();
  if (!/^\d+$/.test(trimmed)) {
    await ctx.reply("❌ Please send a valid numeric post ID.");
    return;
  }
  const postId = Number(trimmed);
  const { configProtected } = await fetchOntonSetting();
  const announcement_channel_id = configProtected['announcement_channel_id'];
  const announcementBotId = configProtected['check_join_bot_token'];

  if (!announcement_channel_id) {
    await ctx.reply("❌ Announcement channel ID is not configured. Please contact the administrator.");
    return;
  }

  const parsedChannelId = parseInt(announcement_channel_id);
  if (isNaN(parsedChannelId)) {
    await ctx.reply("❌ Invalid announcement channel ID. Please contact the administrator.");
    return;
  }

  const buttonBot = new Bot(announcementBotId);
  buttonBot.stop()

  try {
    await buttonBot.api.editMessageReplyMarkup(parsedChannelId, postId, {
      reply_markup: {
        inline_keyboard: []
      }
    });
    await ctx.reply("✅ Existing buttons removed from the post.");
  } catch (error) {
    await ctx.reply("❌ Failed to remove buttons. Ensure the bot has enough rights in the channel.");
  }
  // Clear channel button session
  ctx.session.channelButtonStep = undefined;
  ctx.session.channelButtonPostId = undefined;
  ctx.session.channelButtonLink = undefined;
}

/* -------------------------------------------------------------------------- */
/*                                Commands                                    */
/* -------------------------------------------------------------------------- */


// Modify the /channel_button command handler to check admin before proceeding
channelPostButtonComposer.command("channel_button", async (ctx) => {
  const { isAdmin } = await isUserAdmin(ctx.from?.id.toString() || "");
  if (!isAdmin) return;
  ctx.session.channelButtonStep = "askPostId";
  await ctx.reply("Please send the channel post ID to edit. send /cancel to exit at any point.");
});

channelPostButtonComposer.command("remove_button", async (ctx) => {
  const { isAdmin } = await isUserAdmin(ctx.from?.id.toString() || "");
  if (!isAdmin) return;
  ctx.session.channelButtonStep = "removeButton";
  await ctx.reply("Please send the channel post ID for button removal. send /cancel to exit at any point.");
});
