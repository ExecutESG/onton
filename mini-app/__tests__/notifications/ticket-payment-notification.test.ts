import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationDispatcher } from "@/lib/notifications/notificationDispatcher";
import { TelegramDriver } from "@/lib/notifications/telegramDriver";
import { EmailDriver } from "@/lib/notifications/emailDriver";
import { OrganizerTicketSaleNotification } from "@/lib/notifications/types";
import { claimOrderNotification } from "@/db/modules/orders.db";
import { notifyOrganizerAndAdminOnTicketPayment } from "@/services/orderNotificationService";
import { POST as handleNotifyOrganizerRoute } from "@/app/api/v1/order/notify-organizer/route";
import crypto from "crypto";

// Mocks
const mockTelegramSend = vi.fn();
vi.mock("@/lib/tgBot", () => ({
  sendTelegramMessage: vi.fn(async (props: any) => {
    mockTelegramSend(props);
    if (Number(props.chat_id) === 999999) {
      throw new Error("Telegram blocked by user");
    }
    return { success: true, message: "Message sent successfully" };
  }),
  sendLogNotification: vi.fn(async (props: any) => {
    return { message_id: 12345 };
  }),
}));

const mockRedisPush = vi.fn();
vi.mock("@/lib/redisClient", () => ({
  getRedisClient: vi.fn(async () => ({
    lPush: mockRedisPush,
  })),
}));

// Mock Database
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  execute: vi.fn(),
  query: {
    events: {
      findFirst: vi.fn(),
    },
    users: {
      findFirst: vi.fn(),
    },
    eventRegistrants: {
      findFirst: vi.fn(),
    },
  },
};

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn(async () => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            execute: vi.fn(async () => []),
          })),
          execute: vi.fn(async () => []),
        })),
      })),
    })),
    query: {
      events: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      eventRegistrants: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db/modules/userIdentities.db", () => ({
  default: {
    getIdentitiesByUserId: vi.fn(async () => []),
  },
}));

describe("Ticket Payment Notifications & Deduplication (Issue #1050)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Deduplication / Once-Only Guard (claimOrderNotification)", () => {
    it("returns true when order has notified_at IS NULL and updates it", async () => {
      const mockTrx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(() => ({
                execute: vi.fn(async () => [{ uuid: "order-123" }]),
              })),
            })),
          })),
        })),
      };

      const claimed = await claimOrderNotification("order-123", mockTrx);
      expect(claimed).toBe(true);
      expect(mockTrx.update).toHaveBeenCalled();
    });

    it("returns false on repeated calls when notified_at is already set", async () => {
      const mockTrx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(() => ({
                execute: vi.fn(async () => []), // Row was not matched because notified_at IS NOT NULL
              })),
            })),
          })),
        })),
      };

      const claimed = await claimOrderNotification("order-123", mockTrx);
      expect(claimed).toBe(false);
    });
  });

  describe("2. Organizer Notification Content & Privacy Protection", () => {
    const samplePayload: OrganizerTicketSaleNotification = {
      eventUuid: "11111111-2222-3333-4444-555555555555",
      eventTitle: "Web3 Helsinki Meetup",
      buyerName: "Vitalik B.",
      amount: "2.5",
      currency: "TON",
      ticketTierName: "Early Bird",
      registeredCount: 42,
      capacity: 100,
      recipient: {
        userId: 10,
        telegramId: 888888,
        email: "organizer@onton.live",
        name: "Satoshi",
      },
    };

    it("renders Telegram message with event title, buyer name, amount, tier, and capacity", () => {
      const msg = TelegramDriver.renderOrganizerTicketSaleMessage(samplePayload);

      expect(msg).toContain("New Ticket Purchased!");
      expect(msg).toContain("Web3 Helsinki Meetup");
      expect(msg).toContain("Vitalik B.");
      expect(msg).toContain("2.5 TON");
      expect(msg).toContain("Early Bird");
      expect(msg).toContain("42 / 100 registered");
      expect(msg).toContain("Manage Event");
    });

    it("never leaks buyer email or phone number in Telegram message", () => {
      const msg = TelegramDriver.renderOrganizerTicketSaleMessage(samplePayload);

      // Verify no sensitive PII markers or leaked values
      expect(msg).not.toContain("@example.com");
      expect(msg).not.toContain("+358");
      expect(msg).not.toContain("phone");
      expect(msg).not.toContain("email");
    });

    it("renders Email HTML with event title, buyer name, amount, tier, and attendee count", () => {
      const { subject, html } = EmailDriver.renderOrganizerTicketSaleEmailHtml(samplePayload);

      expect(subject).toContain("New Ticket Purchased: Web3 Helsinki Meetup");
      expect(html).toContain("Web3 Helsinki Meetup");
      expect(html).toContain("Vitalik B.");
      expect(html).toContain("2.5 TON");
      expect(html).toContain("Early Bird");
      expect(html).toContain("42 / 100 registered");
      expect(html).toContain("Manage Event & Guest List");
    });

    it("never leaks buyer email or phone number in Email template", () => {
      const { html } = EmailDriver.renderOrganizerTicketSaleEmailHtml(samplePayload);

      expect(html).not.toContain("+358");
      expect(html).not.toContain("buyer@");
    });
  });

  describe("3. Multi-Channel Dispatcher for Organizer", () => {
    it("dispatches to Telegram when organizer has telegramId", async () => {
      const payload: OrganizerTicketSaleNotification = {
        eventUuid: "evt-abc",
        eventTitle: "Hackathon",
        buyerName: "Bob",
        amount: "50",
        currency: "Stars",
        registeredCount: 5,
        recipient: {
          userId: 1,
          telegramId: 777777,
        },
      };

      const res = await NotificationDispatcher.dispatchOrganizerTicketSaleNotification(payload);
      expect(res.success).toBe(true);
      expect(res.channel).toBe("telegram");
      expect(res.recipientId).toBe(777777);
      expect(mockTelegramSend).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 777777,
        })
      );
    });

    it("falls back to Email when Telegram delivery fails", async () => {
      const payload: OrganizerTicketSaleNotification = {
        eventUuid: "evt-abc",
        eventTitle: "Hackathon",
        buyerName: "Bob",
        amount: "100",
        currency: "Stars",
        registeredCount: 6,
        recipient: {
          userId: 1,
          telegramId: 999999, // Triggers simulated block
          email: "organizer@fallback.com",
        },
      };

      const res = await NotificationDispatcher.dispatchOrganizerTicketSaleNotification(payload);
      expect(res.success).toBe(true);
      expect(res.channel).toBe("email");
      expect(res.fallbackUsed).toBe(true);
      expect(res.recipientId).toBe("organizer@fallback.com");
    });

    it("dispatches to Email directly when organizer is email-only (Google / Email user)", async () => {
      const payload: OrganizerTicketSaleNotification = {
        eventUuid: "evt-abc",
        eventTitle: "Hackathon",
        buyerName: "Bob",
        amount: "10",
        currency: "USDT",
        registeredCount: 7,
        recipient: {
          userId: 2,
          telegramId: null,
          email: "google-organizer@gmail.com",
        },
      };

      const res = await NotificationDispatcher.dispatchOrganizerTicketSaleNotification(payload);
      expect(res.success).toBe(true);
      expect(res.channel).toBe("email");
      expect(res.recipientId).toBe("google-organizer@gmail.com");
    });

    it("returns error gracefully if organizer has neither Telegram nor Email", async () => {
      const payload: OrganizerTicketSaleNotification = {
        eventUuid: "evt-abc",
        eventTitle: "Hackathon",
        buyerName: "Bob",
        amount: "10",
        currency: "USDT",
        registeredCount: 8,
        recipient: {
          userId: 3,
          telegramId: null,
          email: null,
        },
      };

      const res = await NotificationDispatcher.dispatchOrganizerTicketSaleNotification(payload);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Organizer has neither email nor telegramId linked");
    });
  });

  describe("4. Internal HMAC API Route (POST /api/v1/order/notify-organizer)", () => {
    const originalSecret = process.env.BOT_API_HMAC_SECRET;

    beforeEach(() => {
      process.env.BOT_API_HMAC_SECRET = "test-secret-key-1050";
    });

    it("rejects unauthenticated requests missing HMAC signature with 401", async () => {
      const req = new Request("http://localhost:3000/api/v1/order/notify-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderUuid: "test-ord" }),
      });

      const res = await handleNotifyOrganizerRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("authentication_failed");
    });

    it("rejects requests with invalid HMAC signature with 401", async () => {
      const timestamp = Date.now().toString();
      const body = JSON.stringify({ orderUuid: "test-ord" });
      const req = new Request("http://localhost:3000/api/v1/order/notify-organizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "deadbeef12345678deadbeef",
          "x-timestamp": timestamp,
        },
        body,
      });

      const res = await handleNotifyOrganizerRoute(req);
      expect(res.status).toBe(401);
    });

    it("accepts valid HMAC signature and processes payload", async () => {
      const secret = "test-secret-key-1050";
      const timestamp = Date.now().toString();
      const payload = {
        orderUuid: "ord-valid-123",
        eventUuid: "00000000-0000-0000-0000-000000000001",
        buyerUserId: 42,
        buyerName: "Test Buyer",
        amount: 100,
        currency: "Stars",
      };
      const rawBody = JSON.stringify(payload);
      const pathname = "/api/v1/order/notify-organizer";
      const canonical = `${timestamp}.POST.${pathname}.${rawBody}`;
      const signature = crypto.createHmac("sha256", secret).update(canonical).digest("hex");

      const req = new Request(`http://localhost:3000${pathname}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": signature,
          "x-timestamp": timestamp,
        },
        body: rawBody,
      });

      const res = await handleNotifyOrganizerRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("success");
    });
  });

  describe("5. Fault Isolation (notifyOrganizerAndAdminOnTicketPayment)", () => {
    it("handles missing event gracefully without throwing unhandled exceptions", async () => {
      const res = await notifyOrganizerAndAdminOnTicketPayment({
        orderUuid: "ord-not-found",
        eventUuid: "00000000-0000-0000-0000-000000000002",
        buyerUserId: 123,
        amount: 5,
        currency: "TON",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("event_not_found");
      expect(res.organizerNotified).toBe(false);
    });
  });
});

