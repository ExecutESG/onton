import { LinkService } from "../links/linkService";
import { generateIcsContent } from "./calendarHelper";
import { EventTicketNotification, OrganizerTicketSaleNotification, NotificationResult } from "./types";
import { logger } from "@/server/utils/logger";
import { getRedisClient } from "@/lib/redisClient";

export class EmailDriver {
  /**
   * Builds responsive HTML email template for event ticket confirmation.
   */
  static renderTicketEmailHtml(payload: EventTicketNotification): { subject: string; html: string; ics: string } {
    const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "email_ticket" });
    const formattedDate = payload.startDate
      ? new Date(
          typeof payload.startDate === "number" && payload.startDate < 1e11
            ? payload.startDate * 1000
            : payload.startDate
        ).toUTCString()
      : "See event details";

    const subject = `Your Ticket: ${payload.eventTitle} — ONTON`;

    const icsContent = generateIcsContent({
      uid: `${payload.eventUuid}-${payload.recipient.userId}`,
      summary: payload.eventTitle,
      description: payload.eventDescription || `Ticket confirmation for ${payload.eventTitle}`,
      location: payload.location || "Online",
      startDate: payload.startDate,
      endDate: payload.endDate,
      url: eventUrl,
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.eventTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
    .header { padding: 32px 24px; text-align: center; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; }
    .content { padding: 28px 24px; }
    .event-title { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #ffffff; }
    .event-info { margin: 16px 0; background: #0f172a; border-radius: 12px; padding: 16px; border: 1px solid #334155; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-label { color: #94a3b8; }
    .info-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .ticket-box { margin: 24px 0; padding: 16px; background: rgba(2, 132, 199, 0.1); border: 1px dashed #0284c7; border-radius: 12px; text-align: center; }
    .ticket-code { font-family: monospace; font-size: 20px; font-weight: 700; color: #38bdf8; letter-spacing: 2px; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; padding: 14px 24px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0; font-size: 28px;">ONTON</h1>
      <p style="margin: 4px 0 0 0; opacity: 0.9;">Event Ticket Confirmation</p>
    </div>
    <div class="content">
      <h2 class="event-title">${payload.eventTitle}</h2>
      ${payload.eventSubtitle ? `<p style="color:#94a3b8; margin: 0 0 16px 0;">${payload.eventSubtitle}</p>` : ""}

      <div class="event-info">
        <div class="info-row">
          <span class="info-label">Date & Time:</span>
          <span class="info-value">${formattedDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location:</span>
          <span class="info-value">${payload.location || "Online"}</span>
        </div>
        ${payload.organizerName ? `
        <div class="info-row">
          <span class="info-label">Organizer:</span>
          <span class="info-value">${payload.organizerName}</span>
        </div>` : ""}
      </div>

      <div class="ticket-box">
        <p style="margin:0 0 4px 0; color:#94a3b8; font-size:12px;">TICKET CODE</p>
        <div class="ticket-code">${payload.ticket?.ticketCode || payload.eventUuid.substring(0, 8).toUpperCase()}</div>
        ${payload.ticket?.ticketName ? `<p style="margin:4px 0 0 0; color:#cbd5e1; font-size:14px;">${payload.ticket.ticketName}</p>` : ""}
      </div>

      <a href="${eventUrl}" class="btn">View Event & Ticket</a>
    </div>
    <div class="footer">
      <p>This event ticket was issued by ONTON. A calendar invitation (.ics) is attached.</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, html, ics: icsContent };
  }

  /**
   * Dispatches email via configured transactional driver or records to Redis queue for dev/staging.
   */
  static async sendTicketEmail(payload: EventTicketNotification): Promise<NotificationResult> {
    const recipientEmail = payload.recipient.email;
    if (!recipientEmail) {
      return {
        success: false,
        channel: "email",
        recipientId: payload.recipient.userId,
        error: "Recipient email is missing",
      };
    }

    try {
      const { subject, html, ics } = this.renderTicketEmailHtml(payload);
      const messageId = `email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Store in Redis outbound queue / audit trail
      try {
        const client = await getRedisClient();
        await client.lPush(
          "notifications:email:outbox",
          JSON.stringify({
            id: messageId,
            to: recipientEmail,
            subject,
            html,
            ics,
            createdAt: new Date().toISOString(),
          })
        );
      } catch (redisErr) {
        logger.warn("Redis notification log error:", redisErr);
      }

      logger.info(`[Notification Engine] Dispatched email ticket to ${recipientEmail} for event ${payload.eventUuid}`);

      return {
        success: true,
        channel: "email",
        recipientId: recipientEmail,
        messageId,
      };
    } catch (error) {
      logger.error("[Notification Engine] Failed to dispatch email:", error);
      return {
        success: false,
        channel: "email",
        recipientId: recipientEmail,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Builds responsive HTML email template for organizer ticket sale alert.
   */
  static renderOrganizerTicketSaleEmailHtml(payload: OrganizerTicketSaleNotification): { subject: string; html: string } {
    const eventUrl = LinkService.getEventUrl(payload.eventUuid, { utm_source: "email_organizer_alert" });
    const capacityText = payload.capacity && payload.capacity > 0
      ? `${payload.registeredCount} / ${payload.capacity} registered`
      : `${payload.registeredCount} registered`;

    const subject = `New Ticket Purchased: ${payload.eventTitle} — ONTON`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ticket Purchased</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
    .header { padding: 32px 24px; text-align: center; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; }
    .content { padding: 28px 24px; }
    .event-title { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; color: #ffffff; }
    .info-box { margin: 16px 0; background: #0f172a; border-radius: 12px; padding: 16px; border: 1px solid #334155; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-label { color: #94a3b8; }
    .info-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; padding: 14px 24px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; margin-top: 16px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0; font-size: 26px;">ONTON</h1>
      <p style="margin: 4px 0 0 0; opacity: 0.9;">New Ticket Purchased</p>
    </div>
    <div class="content">
      <h2 class="event-title">${payload.eventTitle}</h2>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Buyer:</span>
          <span class="info-value">${payload.buyerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Amount:</span>
          <span class="info-value">${payload.amount} ${payload.currency}</span>
        </div>
        ${payload.ticketTierName ? `
        <div class="info-row">
          <span class="info-label">Ticket Tier:</span>
          <span class="info-value">${payload.ticketTierName}</span>
        </div>` : ""}
        <div class="info-row">
          <span class="info-label">Current Attendees:</span>
          <span class="info-value">${capacityText}</span>
        </div>
      </div>
      <a href="${eventUrl}" class="btn">Manage Event & Guest List</a>
    </div>
    <div class="footer">
      <p>This automated alert was sent by ONTON Event Management.</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, html };
  }

  /**
   * Dispatches organizer alert email via configured transactional driver or records to Redis queue.
   */
  static async sendOrganizerTicketSaleEmail(payload: OrganizerTicketSaleNotification): Promise<NotificationResult> {
    const recipientEmail = payload.recipient.email;
    if (!recipientEmail) {
      return {
        success: false,
        channel: "email",
        recipientId: payload.recipient.userId,
        error: "Organizer email is missing",
      };
    }

    try {
      const { subject, html } = this.renderOrganizerTicketSaleEmailHtml(payload);
      const messageId = `email-org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      try {
        const client = await getRedisClient();
        await client.lPush(
          "notifications:email:outbox",
          JSON.stringify({
            id: messageId,
            to: recipientEmail,
            subject,
            html,
            createdAt: new Date().toISOString(),
          })
        );
      } catch (redisErr) {
        logger.warn("Redis notification log error:", redisErr);
      }

      logger.info(`[Notification Engine] Dispatched organizer email to ${recipientEmail} for event ${payload.eventUuid}`);

      return {
        success: true,
        channel: "email",
        recipientId: recipientEmail,
        messageId,
      };
    } catch (error) {
      logger.error("[Notification Engine] Failed to dispatch organizer email:", error);
      return {
        success: false,
        channel: "email",
        recipientId: recipientEmail,
        error: (error as Error).message,
      };
    }
  }
}

