import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";
import { is_mainnet } from "@/services/tonCenter";

/**
 * Tries to deliver a Telegram message up to 10× with 2-second pauses.
 * Resolves `{ ok: true }` on success, otherwise throws the last error.
 */
export async function sendTelegramWithRetryRaffle(args: {
  chat_id: string | number;
  message: string;
  link?: string;
  linkText?: string;
}): Promise<{ ok: true }> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const res = await sendTelegramMessage(args);

    if (res.success) {
      return { ok: true };
    }

    logger.warn(`[tg-retry] attempt ${attempt}/10 failed for chat ${args.chat_id}: ${res.error ?? "unknown"}`);

    // last run -> throw
    if (attempt === 10) {
      throw new Error(res.error ?? "Unknown Telegram error");
    }

    // wait 2s and try again
    await new Promise((r) => setTimeout(r, 2_000));
  }

  /* never reached */
  throw new Error("unreachable");
}
