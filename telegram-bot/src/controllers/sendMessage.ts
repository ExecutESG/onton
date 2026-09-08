import { Bot, GrammyError } from "grammy";
import { logger } from "../utils/logger";
import { Request, Response } from "express";

interface SendRewardLinkBody {
  chat_id: number;
  link: string;
  custom_message: string;
  linkText?: string;
}

/**
 * Sends a message to a Telegram chat.
 *
 * @param {Request & { bot: Bot }} req - The request object.
 * @param {Response} res - The response object.
 * @return {Promise<Response>} The response object.
 */
export const sendMessage = async (
  req: Request & { bot: Bot },
  res: Response,
  tryCount: number = 0,
): Promise<Response> => {
  try {
    // Destructure the request body
    const { chat_id, link, custom_message, linkText }: SendRewardLinkBody = req.body;

    // Input validation
    if (!chat_id || typeof Number(chat_id) !== "number") {
      // Return an error response if chat_id is invalid or missing
      return res.status(400).json({ error: "Invalid or missing chat_id" });
    }
    if (link && (typeof link !== "string" || !link?.startsWith("http"))) {
      // Return an error response if link is invalid
      return res.status(400).json({ error: "Invalid link" });
    }
    if (!custom_message || typeof custom_message !== "string") {
      // Return an error response if custom_message is missing or invalid
      return res.status(400).json({ error: "Invalid custom_message" });
    }

    // Create the reply_markup object if link is provided
    const reply_markup = link
      ? {
        inline_keyboard: [
          [
            {
              text: linkText || "Claim Reward",
              url: link,
            },
          ],
        ],
      }
      : undefined;

    // Send the message to the chat
    await req.bot.api.sendMessage(chat_id, custom_message.trim(), {
      reply_markup,
      parse_mode: "HTML",
    });

    // Return a success response
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error: any) {
    if (res.headersSent) {
      return res;
    }

    if (
      error instanceof GrammyError &&
      error.error_code === 429 &&
      tryCount < 10
    ) {
      const waitSec = error.parameters?.retry_after ?? 1;
      logger.warn(`BOT_ERROR: 429 rate limit hit. Waiting ${waitSec}s (attempt ${tryCount + 1}/10)...`);

      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      return await sendMessage(req, res, tryCount + 1);
    }

    // Differentiate between Telegram API errors and other errors
    if (error instanceof GrammyError) {
      logger.error("TELEGRAM_GRAMMY_ERROR:", error.description);
      return res.status(error.error_code || 500).json({
        success: false,
        error: error.description,
      });
    }

    if (error.response?.statusCode) {
      const errorMessage =
        error.response.description ||
        "An error occurred while sending the message.";
      logger.error("TELEGRAM_ERROR:", errorMessage);
      return res.status(error.response.statusCode).json({
        success: false,
        error: errorMessage,
      });
    }

    // Handle other unexpected errors
    logger.error("Unexpected error sending message:", error);
    return res.status(500).json({
      success: false,
      error: "Unexpected server error. Please try again later.",
    });
  }
};
