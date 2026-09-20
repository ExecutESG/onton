import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateIcsContent } from "@/lib/notifications/calendarHelper";
import { EmailDriver } from "@/lib/notifications/emailDriver";
import { TelegramDriver } from "@/lib/notifications/telegramDriver";
import { NotificationDispatcher } from "@/lib/notifications/notificationDispatcher";
import { EventTicketNotification } from "@/lib/notifications/types";

// Mock external services
vi.mock("@/lib/tgBot", () => ({
  sendTelegramMessage: vi.fn(async (props: { chat_id: number | string }) => {
    if (Number(props.chat_id) === 999999) {
      throw new Error("Telegram blocked by user");
    }
    return { success: true, message: "Message sent successfully" };
  }),
}));

vi.mock("@/lib/redisClient", () => ({
  getRedisClient: vi.fn(async () => ({
    lPush: vi.fn(async () => 1),
  })),
}));

describe("Multi-Channel Notification Engine", () => {
  const samplePayload: EventTicketNotification = {
    eventUuid: "evt-uuid-abc",
    eventTitle: "ONTON Web3 Summit 2026",
    eventSubtitle: "The Premier Community Gathering",
    eventDescription: "Join developers and builders worldwide.",
    location: "Online / Dubai",
    startDate: 1774000000,
    endDate: 1774010000,
    organizerName: "ONTON Foundation",
    recipient: {
      userId: 42,
      email: "attendee@example.com",
      telegramId: 12345678,
      name: "Alice",
    },
    ticket: {
      ticketName: "VIP Pass",
      ticketCode: "VIP-9999",
      ticketPrice: "0",
    },
  };

  it("generates RFC 5545 compliant iCalendar content", () => {
    const ics = generateIcsContent({
      uid: "evt-123-user-456",
      summary: "ONTON Summit",
      description: "Annual conference",
      location: "San Francisco",
      startDate: new Date("2026-10-15T10:00:00Z"),
      endDate: new Date("2026-10-15T12:00:00Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:evt-123-user-456@onton.live");
    expect(ics).toContain("SUMMARY:ONTON Summit");
    expect(ics).toContain("LOCATION:San Francisco");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("renders responsive HTML email with ticket code and calendar invite", () => {
    const { subject, html, ics } = EmailDriver.renderTicketEmailHtml(samplePayload);

    expect(subject).toContain("ONTON Web3 Summit 2026");
    expect(html).toContain("ONTON Web3 Summit 2026");
    expect(html).toContain("VIP-9999");
    expect(html).toContain("View Event & Ticket");
    expect(ics).toContain("ONTON Web3 Summit 2026");
  });

  it("renders Telegram markdown message with event link", () => {
    const msg = TelegramDriver.renderTicketMessage(samplePayload);

    expect(msg).toContain("Ticket Confirmed: ONTON Web3 Summit 2026");
    expect(msg).toContain("VIP-9999");
    expect(msg).toContain("Open Event & Ticket");
  });

  it("dispatches to Email when preferred channel is email", async () => {
    const emailPayload: EventTicketNotification = {
      ...samplePayload,
      recipient: {
        ...samplePayload.recipient,
        preferredChannel: "email",
      },
    };

    const res = await NotificationDispatcher.dispatchTicketNotification(emailPayload);
    expect(res.success).toBe(true);
    expect(res.channel).toBe("email");
    expect(res.recipientId).toBe("attendee@example.com");
  });

  it("dispatches to Telegram when telegramId exists and no explicit preference", async () => {
    const res = await NotificationDispatcher.dispatchTicketNotification(samplePayload);
    expect(res.success).toBe(true);
    expect(res.channel).toBe("telegram");
    expect(res.recipientId).toBe(12345678);
  });

  it("falls back to Email when Telegram delivery fails", async () => {
    const failingTgPayload: EventTicketNotification = {
      ...samplePayload,
      recipient: {
        ...samplePayload.recipient,
        telegramId: 999999, // Triggers simulated block
      },
    };

    const res = await NotificationDispatcher.dispatchTicketNotification(failingTgPayload);
    expect(res.success).toBe(true);
    expect(res.channel).toBe("email");
    expect(res.fallbackUsed).toBe(true);
    expect(res.recipientId).toBe("attendee@example.com");
  });

  it("fails gracefully if recipient has neither email nor telegramId", async () => {
    const unlinkedPayload: EventTicketNotification = {
      ...samplePayload,
      recipient: {
        userId: 99,
        email: null,
        telegramId: null,
      },
    };

    const res = await NotificationDispatcher.dispatchTicketNotification(unlinkedPayload);
    expect(res.success).toBe(false);
    expect(res.error).toContain("neither email nor telegramId");
  });
});
