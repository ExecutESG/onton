import { EmailDriver } from "./emailDriver";
import { TelegramDriver } from "./telegramDriver";
import { EventTicketNotification, NotificationChannel, NotificationResult } from "./types";
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
}
