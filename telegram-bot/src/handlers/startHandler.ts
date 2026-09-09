import { Context } from "grammy";
import { logger } from "../utils/logger";
import { editOrSend } from "../utils/utils";
import { startKeyboard } from "../markups";
import { getUser, updateUserProfile } from "../db/db"; // or wherever you defined update logic

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
        if (rawParam.startsWith("event_")) {
          const eventUuid = rawParam.replace("event_", "");
          targetUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/events/${eventUuid}`;
          buttonText = "Open Event";
        } else if (rawParam.startsWith("join_")) {
          targetUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/?startapp=${rawParam}`;
          buttonText = "Join ONTON";
        } else if (rawParam.startsWith("tournament_")) {
          const tournamentId = rawParam.replace("tournament_", "");
          targetUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/tournaments/${tournamentId}`;
          buttonText = "Open Tournament";
        }
      }
    }

    // 7) Send or edit a welcome message, showing your start keyboard
    const welcomeMessage = `✨ <b>Welcome to ONTON — The Luma of Telegram & Web3</b> ✨

Discover, host, and experience the best events across the Telegram & Web3 ecosystem!

🎟️ <b>1-Tap Free RSVP</b> — Join events in one click without wallet friction.
⭐ <b>Telegram Stars & Crypto</b> — Buy tickets natively with Stars (Apple/Google Pay) or TON/USDT.
💬 <b>Instant Event Chat Access</b> — Get private, single-use invite links to attendee groups.
🏆 <b>Proof-of-Attendance Badges</b> — Collect verifiable digital badges as memories.

Ready to explore? Choose an option below 👇`;

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
