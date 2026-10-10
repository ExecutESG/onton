import { EmailDriver } from "./emailDriver";
import { TelegramDriver } from "./telegramDriver";
import { EventTicketNotification, OrganizerTicketSaleNotification, NotificationChannel, NotificationResult } from "./types";
import { logger } from "@/server/utils/logger";

export class NotificationDispatcher {
  /**
   * Intelligently dispatches an event ticket notification across available channels
   * with automatic fallback.
   */
  static async dispatchTicketNotification(
    payload: EventTicketNotification
  ): Promise<NotificationResult> {
    const { recipient } = payload;
    const hasEmail = Boolean(recipient.email);
    const hasTelegram = Boolean(recipient.telegramId);

    if (!hasEmail && !hasTelegram) {
      return {
        success: false,
        channel: "in_app",
        recipientId: recipient.userId,
        error: "Recipient has neither email nor telegramId linked",
      };
    }

    // Determine primary and secondary channels
    let primaryChannel: NotificationChannel = "telegram";
    let fallbackChannel: NotificationChannel | null = null;

    if (recipient.preferredChannel === "email" && hasEmail) {
      primaryChannel = "email";
      if (hasTelegram) fallbackChannel = "telegram";
    } else if (hasTelegram) {
      primaryChannel = "telegram";
      if (hasEmail) fallbackChannel = "email";
    } else {
      primaryChannel = "email";
    }

    // Attempt primary channel
    const primaryResult = await this.sendViaChannel(primaryChannel, payload);
    if (primaryResult.success) {
      return primaryResult;
    }

    // Primary failed; check if fallback channel is viable
    if (fallbackChannel) {
      logger.warn(
        `[Notification Dispatcher] Primary channel ${primaryChannel} failed: ${primaryResult.error}. Attempting fallback to ${fallbackChannel}.`
      );

      const fallbackResult = await this.sendViaChannel(fallbackChannel, payload);
      return {
        ...fallbackResult,
        fallbackUsed: true,
      };
    }

    return primaryResult;
  }

  private static async sendViaChannel(
    channel: NotificationChannel,
    payload: EventTicketNotification
  ): Promise<NotificationResult> {
    if (channel === "email") {
      return await EmailDriver.sendTicketEmail(payload);
    }

    if (channel === "telegram") {
      return await TelegramDriver.sendTicketMessage(payload);
    }

    return {
      success: false,
      channel,
      recipientId: payload.recipient.userId,
      error: `Unsupported notification channel: ${channel}`,
    };
  }

  /**
   * Intelligently dispatches an organizer notification for ticket sale across available channels
   * with automatic fallback.
   */
  static async dispatchOrganizerTicketSaleNotification(
    payload: OrganizerTicketSaleNotification
  ): Promise<NotificationResult> {
    const { recipient } = payload;
    const hasEmail = Boolean(recipient.email);
    const hasTelegram = Boolean(recipient.telegramId);

    if (!hasEmail && !hasTelegram) {
      return {
        success: false,
        channel: "in_app",
        recipientId: recipient.userId,
        error: "Organizer has neither email nor telegramId linked",
      };
    }

    // Default: Telegram first, fallback to Email (Google/Email organizers)
    let primaryChannel: NotificationChannel = "telegram";
    let fallbackChannel: NotificationChannel | null = null;

    if (recipient.preferredChannel === "email" && hasEmail) {
      primaryChannel = "email";
      if (hasTelegram) fallbackChannel = "telegram";
    } else if (hasTelegram) {
      primaryChannel = "telegram";
      if (hasEmail) fallbackChannel = "email";
    } else {
      primaryChannel = "email";
    }

    // Attempt primary channel
    const primaryResult = await this.sendOrganizerViaChannel(primaryChannel, payload);
    if (primaryResult.success) {
      return primaryResult;
    }

    // Primary failed; check if fallback channel is viable
    if (fallbackChannel) {
      logger.warn(
        `[Notification Dispatcher] Organizer primary channel ${primaryChannel} failed: ${primaryResult.error}. Attempting fallback to ${fallbackChannel}.`
      );

      const fallbackResult = await this.sendOrganizerViaChannel(fallbackChannel, payload);
      return {
        ...fallbackResult,
        fallbackUsed: true,
      };
    }

    return primaryResult;
  }

  private static async sendOrganizerViaChannel(
    channel: NotificationChannel,
    payload: OrganizerTicketSaleNotification
  ): Promise<NotificationResult> {
    if (channel === "email") {
      return await EmailDriver.sendOrganizerTicketSaleEmail(payload);
    }

    if (channel === "telegram") {
      return await TelegramDriver.sendOrganizerTicketSaleMessage(payload);
    }

    return {
      success: false,
      channel,
      recipientId: payload.recipient.userId,
      error: `Unsupported notification channel: ${channel}`,
    };
  }
}

