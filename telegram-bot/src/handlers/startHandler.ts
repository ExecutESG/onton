import { Context } from "grammy";
import { logger } from "../utils/logger";
import { editOrSend } from "../utils/utils";
import { startKeyboard } from "../markups";
import { getUser, updateUserProfile } from "../db/db"; // or wherever you defined update logic

import { resolveDeepLink } from "../utils/deepLink";

export const startHandler = async (ctx: Context) => {
  try {
    // 1) Get basic info from Telegram context
    const userId = ctx.from?.id;
    if (!userId) {
      return; // If we can't identify the user, just exit
    }

    // 2) Check if user already exists in DB
    let user = await getUser(String(userId));
    logger.log(`User ID=${userId} and username ${ctx.from?.username} started the bot.`);
    // 3) If user does NOT exist, insert a new record
    if (user) {
      // 4) If user exists but previously blocked the bot, set has_blocked_the_bot=false
      if (user.has_blocked_the_bot) {
        await updateUserProfile(userId, { hasBlockedBot: false });
        logger.log(`User ID=${userId} and username ${ctx.from?.username}  had blocked the bot; now unblocked.`);
      }
    }

    // 6) Parse any `/start` params in the incoming message
    const messageText = ctx.message?.text;
    let targetUrl: string | undefined;
    let buttonText: string | undefined;

    if (
      messageText &&
      messageText.split(" ").length === 2 &&
      messageText.split(" ")[0] === "/start"
    ) {
      const rawParam = messageText.split(" ")[1];
      if (rawParam) {
        const resolved = resolveDeepLink(rawParam);
        if (resolved) {
          targetUrl = resolved.targetUrl;
          buttonText = resolved.buttonText;
        }
      }
    }

    // 7) Send or edit a welcome message, showing your start keyboard
    const welcomeMessage = `<b>ONTON: Events with Verified Attendance</b>

Create an event in a minute. Free events are free forever. Verified attendance, built in.

🎟️ <b>1-Tap RSVP:</b> Register in seconds with zero wallet friction.
⭐ <b>Flexible Ticketing:</b> Pay with Telegram Stars (Apple/Google Pay) or crypto (TON/USDT).
🔒 <b>Automated Chat Gating:</b> Single-use invite links to attendee groups.
🏅 <b>Verified Attendance:</b> Portable credentials and digital event badges.

332K people with attendance credentials · 633K verified in-person check-ins.

Choose an option below:`;

    await editOrSend(
      ctx,
      welcomeMessage,
      startKeyboard(targetUrl, buttonText),
      undefined,
      false,
    );
  } catch (error) {
    logger.error("Error in startHandler:", error);
  }
};
