import { Request, Response } from "express";
import { Bot } from "grammy";
import { getEvent } from "../db/db";
import { logger } from "../utils/logger";
import { formatDateInTimezone } from "../helpers/formatDateInTimezone";
import { processAndSendImage } from "../helpers/processAndSendImage";

export const handleShareEvent = async (
  req: Request & {
    bot: Bot;
  },
  res: Response,
) => {
  const { id, user_id, url, share_link, custom_button } = req.body;

  if (
    typeof id === "string" &&
    typeof user_id === "string" &&
    typeof url === "string" &&
    typeof share_link === "string"
  ) {
    try {
      const event = await getEvent(id);

      const startDateInSeconds = Number(event.start_date);
      const endDateInSeconds = Number(event.end_date);

      // Specify your desired timezone here (e.g., "GMT+5" or "America/New_York")
      const timeZone = event.timezone;

      if (isNaN(startDateInSeconds) || isNaN(endDateInSeconds)) {
        throw new Error("Invalid date values.");
      }

      // Format startDate and endDate with timezone
      const startDate = formatDateInTimezone(startDateInSeconds, timeZone);
      const endDate = formatDateInTimezone(endDateInSeconds, timeZone);

      const isFree = !event.has_payment;
      const defaultButton = {
        text: isFree ? "🎟️ RSVP (Free)" : "🎫 Get Ticket",
        web_app: { url },
      };
      const customButton = custom_button || defaultButton;

      // Try to process and send the image
      try {
        await processAndSendImage(
          event,
          user_id,
          req.bot,
          startDate,
          endDate,
          share_link,
          customButton,
        );
      } catch (error) {
        logger.error("Final fallback - using default image");
        // Final fallback - use default image
        await req.bot.api.sendPhoto(
          parseInt(user_id),
          "https://app.onton.live/template-images/default.webp",
          {
            caption: `
📄 <b>${event.title}</b>
👉 <i>${event.subtitle}</i>

🗓 Starts at: ${startDate}

🗓 Ends at: ${endDate}

🔗 Link: ${share_link}
`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[customButton]],
            },
          },
        );
      }

      res.json(event);
    } catch (error) {
      logger.log(error);
      res.status(404).json({ message: "Event not found" });
    }
  } else {
    res.status(400).json({ message: "Invalid query id" });
  }
};
