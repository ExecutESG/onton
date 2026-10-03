import { LinkService } from "../links/linkService";
import { EventTicketNotification, NotificationResult } from "./types";
import { logger } from "@/server/utils/logger";
import { sendTelegramMessage } from "@/lib/tgBot";

export class TelegramDriver {
  /**
   * Builds Telegram HTML message for ticket confirmation.
   */
  static renderTicketMessage(payload: EventTicketNotification): string {
    const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "tg_notification" });
    const formattedDate = payload.startDate
      ? new Date(
          typeof payload.startDate === "number" && payload.startDate < 1e11
            ? payload.startDate * 1000
            : payload.startDate
        ).toUTCString()
      : "See details";

    return `
🎟️ <b>Ticket Confirmed: ${payload.eventTitle}</b>

📅 <b>Date:</b> ${formattedDate}
📍 <b>Location:</b> ${payload.location || "Online"}
${payload.ticket?.ticketCode ? `🔑 <b>Ticket Code:</b> <code>${payload.ticket.ticketCode}</code>\n` : ""}
🔗 <a href="${eventUrl}">Open Event & Ticket</a>
`.trim();
  }

  /**
   * Dispatches Telegram notification to recipient.
   */
  static async sendTicketMessage(payload: EventTicketNotification): Promise<NotificationResult> {
    const telegramId = payload.recipient.telegramId;
    if (!telegramId) {
      return {
        success: false,
        channel: "telegram",
        recipientId: payload.recipient.userId,
        error: "Recipient telegramId is missing",
      };
    }

    try {
      const message = this.renderTicketMessage(payload);
      const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "tg_notification" });
      const res = await sendTelegramMessage({
        chat_id: Number(telegramId),
        message,
        link: eventUrl,
        linkText: "View Event & Ticket",
      });

      logger.info(`[Notification Engine] Dispatched Telegram ticket message to ${telegramId} for ${payload.eventUuid}`);

      return {
        success: Boolean(res?.success),
        channel: "telegram",
        recipientId: telegramId,
        messageId: res?.success ? "tg-sent" : undefined,
      };
    } catch (error) {
      logger.error(`[Notification Engine] Failed to dispatch Telegram message to ${telegramId}:`, error);
      return {
        success: false,
        channel: "telegram",
        recipientId: telegramId,
        error: (error as Error).message,
      };
    }
  }
}
