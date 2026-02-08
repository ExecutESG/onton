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
    let path;
    if (
      messageText &&
      messageText.split(" ").length === 2 &&
      messageText.split(" ")[0] === "/start"
    ) {
      path = messageText.split(" ")[1];
    }

    // 7) Send or edit a welcome message, showing your start keyboard
    await editOrSend(
      ctx,
      `Welcome to ONTON, your gateway to the best events on the TON blockchain and beyond!

<b>Explore Events</b>: Discover a variety of exciting events, from Play2Win games and meetups to exclusive NFT drops.
 
Get started now and dive into the ONTON experience!`

      ,
      startKeyboard(),
      undefined,
      false,
    );
  } catch (error) {
    logger.error("Error in startHandler:", error);
  }
};
