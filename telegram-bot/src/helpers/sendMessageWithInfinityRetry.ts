/* -------------------------------------------------------------------------- */
/*                       Helper: Send Message With Retry                      */

/* -------------------------------------------------------------------------- */

import { MyContext } from "../types/MyContext";
import { GrammyError } from "grammy";
import { sleep } from "../utils/utils";
import { logger } from "../utils/logger";

export async function sendMessageWithInfinityRetry(
  user_id: number | string,
  msg: string,
  ctx: MyContext,
  retries = 0,
  maxRetries = 5
) {
  try {
    await ctx.api.sendMessage(user_id, msg);
  } catch (error) {
    if (error instanceof GrammyError) {
      // Rate-limiting or blocked etc.
      if (error.error_code === 429 && retries < maxRetries) {
        const waitSec = error.parameters?.retry_after || 1;
        logger.warn(
          `429 FloodWait sending broadcast to ${user_id}. Waiting ${waitSec}s (retry ${retries + 1}/${maxRetries})...`
        );
        await sleep(waitSec * 1000);
        return sendMessageWithInfinityRetry(user_id, msg, ctx, retries + 1, maxRetries);
      }
      // If user blocked the bot or something, we can ignore or log
      logger.error(`Failed to send broadcast to ${user_id}: ${error.description}`);
    }
  }
}