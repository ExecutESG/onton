import { LinkService } from "../links/linkService";
import { EventTicketNotification, OrganizerTicketSaleNotification, NotificationResult } from "./types";
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

  /**
   * Builds Telegram HTML message for organizer ticket sale alert.
   */
  static renderOrganizerTicketSaleMessage(payload: OrganizerTicketSaleNotification): string {
    const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "organizer_ticket_alert" });
    const capacityText = payload.capacity && payload.capacity > 0
      ? `${payload.registeredCount} / ${payload.capacity} registered`
      : `${payload.registeredCount} registered`;

    const tierPart = payload.ticketTierName ? `\n🎟️ <b>Tier:</b> ${payload.ticketTierName}` : "";

    return `
🎉 <b>New Ticket Purchased!</b>

📌 <b>Event:</b> ${payload.eventTitle}
👤 <b>Buyer:</b> ${payload.buyerName}
💰 <b>Amount:</b> ${payload.amount} ${payload.currency}${tierPart}
📊 <b>Attendees:</b> ${capacityText}

🔗 <a href="${eventUrl}">Manage Event</a>
`.trim();
  }

  /**
   * Dispatches Telegram notification to organizer.
   */
  static async sendOrganizerTicketSaleMessage(payload: OrganizerTicketSaleNotification): Promise<NotificationResult> {
    const telegramId = payload.recipient.telegramId;
    if (!telegramId) {
      return {
        success: false,
        channel: "telegram",
        recipientId: payload.recipient.userId,
        error: "Organizer telegramId is missing",
      };
    }

    try {
      const message = this.renderOrganizerTicketSaleMessage(payload);
      const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "organizer_ticket_alert" });
      const res = await sendTelegramMessage({
        chat_id: Number(telegramId),
        message,
        link: eventUrl,
        linkText: "Manage Event",
      });

      logger.info(`[Notification Engine] Dispatched Telegram organizer ticket sale message to ${telegramId} for ${payload.eventUuid}`);

      return {
        success: Boolean(res?.success),
        channel: "telegram",
        recipientId: telegramId,
        messageId: res?.success ? "tg-sent" : undefined,
      };
    } catch (error) {
      logger.error(`[Notification Engine] Failed to dispatch Telegram message to organizer ${telegramId}:`, error);
      return {
        success: false,
        channel: "telegram",
        recipientId: telegramId,
        error: (error as Error).message,
      };
    }
  }
}

