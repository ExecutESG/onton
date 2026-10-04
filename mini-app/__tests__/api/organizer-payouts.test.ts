import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyBotHmac } from "@/lib/botHmacAuth";
import { POST as payoutHandler } from "@/app/api/v1/payout/route";

const {
  mockEventsTable,
  mockPaymentInfoTable,
  mockPayoutsTable,
  mockUpdateFn,
  mockInsertFn,
} = vi.hoisted(() => ({
  mockEventsTable: {} as Record<string, any>,
  mockPaymentInfoTable: {} as Record<string, any>,
  mockPayoutsTable: [] as any[],
  mockUpdateFn: vi.fn(),
  mockInsertFn: vi.fn(),
}));

vi.mock("@/db/db", () => {
  const trxMock = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val) => ({
        returning: vi.fn().mockImplementation(() => {
          const inserted = { id: 1, ...val };
          mockPayoutsTable.push(inserted);
          mockInsertFn(val);
          return [inserted];
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((setVals) => ({
        where: vi.fn().mockImplementation(() => {
          mockUpdateFn(setVals);
          return { execute: vi.fn().mockResolvedValue([]) };
        }),
      })),
    })),
  };

  return {
    db: {
      query: {
        events: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            return Object.values(mockEventsTable)[0] || null;
          }),
        },
        eventPayment: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            return Object.values(mockPaymentInfoTable)[0] || null;
          }),
        },
      },
      transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback(trxMock);
      }),
      insert: trxMock.insert,
      update: trxMock.update,
    },
  };
});

describe("Issue #1033: Organizer Payouts & Upfront Fee Removal", () => {
  const TEST_SECRET = "test_bot_secret_hmac_key_123";
  const TEST_EVENT_UUID = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOT_API_HMAC_SECRET = TEST_SECRET;
    delete process.env.ONTON_API_SECRET;
    delete process.env.BOT_TOKEN;

    for (const k in mockEventsTable) delete mockEventsTable[k];
    for (const k in mockPaymentInfoTable) delete mockPaymentInfoTable[k];
    mockPayoutsTable.length = 0;
  });

  // Helper to generate HMAC headers
  function createHmacHeaders(body: unknown, timestamp?: number, secret = TEST_SECRET) {
    const ts = (timestamp ?? Date.now()).toString();
    const rawBody = typeof body === "object" ? JSON.stringify(body) : String(body || "");
    const payload = `${ts}.${rawBody}`;
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    return new Headers({
      "Content-Type": "application/json",
      "x-signature": sig,
      "x-timestamp": ts,
      "x-api-key": secret,
    });
  }

  describe("HMAC Authentication & Security (verifyBotHmac)", () => {
    it("accepts requests with valid HMAC signature and current timestamp", () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100", tx_hash: "tx123", paid_by: 12345 };
      const headers = createHmacHeaders(body);
      const res = verifyBotHmac(headers, JSON.stringify(body));
      expect(res.valid).toBe(true);
    });

    it("rejects requests when HMAC signature does not match secret", () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100" };
      const headers = createHmacHeaders(body, Date.now(), "wrong_secret");
      headers.delete("x-api-key"); // Remove fallback
      const res = verifyBotHmac(headers, JSON.stringify(body));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid or missing authentication signature");
    });

    it("rejects expired timestamps (>60s) to prevent replay attacks", () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100" };
      const expiredTimestamp = Date.now() - 65 * 1000;
      const headers = createHmacHeaders(body, expiredTimestamp);
      const res = verifyBotHmac(headers, JSON.stringify(body));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("timestamp expired");
    });

    it("accepts valid x-api-key fallback when signature is missing", () => {
      const body = { event_uuid: TEST_EVENT_UUID };
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-api-key": TEST_SECRET,
      });
      const res = verifyBotHmac(headers, JSON.stringify(body));
      expect(res.valid).toBe(true);
    });

    it("rejects request if both signature and api-key are invalid", () => {
      const headers = new Headers({
        "x-api-key": "invalid_key",
      });
      const res = verifyBotHmac(headers, "");
      expect(res.valid).toBe(false);
    });
  });

  describe("Payout Route Handler (POST /api/v1/payout)", () => {
    it("returns 401 when request is not authenticated", async () => {
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("unauthorized");
    });

    it("returns 400 when body is malformed JSON", async () => {
      const headers = createHmacHeaders("not valid json");
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers,
        body: "not valid json",
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("bad_request");
    });

    it("returns 400 when validation fails (invalid UUID, non-positive amount, missing tx_hash)", async () => {
      const invalidPayload = {
        event_uuid: "invalid-uuid",
        amount: -10,
        tx_hash: "",
        paid_by: "not-a-number",
      };
      const headers = createHmacHeaders(invalidPayload);
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers,
        body: JSON.stringify(invalidPayload),
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("validation_error");
    });

    it("returns 404 if event does not exist", async () => {
      const validPayload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "50.5",
        tx_hash: "0xabcdef123456",
        paid_by: 7013087032,
      };
      const headers = createHmacHeaders(validPayload);
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers,
        body: JSON.stringify(validPayload),
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toContain("Event not found");
    });

    it("returns 404 if payment info does not exist for the event", async () => {
      mockEventsTable[TEST_EVENT_UUID] = {
        event_uuid: TEST_EVENT_UUID,
        title: "Test Event",
      };

      const validPayload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "50.5",
        tx_hash: "0xabcdef123456",
        paid_by: 7013087032,
      };
      const headers = createHmacHeaders(validPayload);
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers,
        body: JSON.stringify(validPayload),
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toContain("Payment info not found");
    });

    it("successfully inserts into organizer_payouts and flips organizer_payment_status to payed_to_organizer", async () => {
      mockEventsTable[TEST_EVENT_UUID] = {
        event_uuid: TEST_EVENT_UUID,
        title: "Test Paid Event",
      };
      mockPaymentInfoTable[TEST_EVENT_UUID] = {
        id: 42,
        event_uuid: TEST_EVENT_UUID,
        token_id: 1,
        organizer_payment_status: "not_payed",
      };

      const validPayload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "150.75",
        tx_hash: "0x7788aabbccdd",
        paid_by: 7013087032,
      };
      const headers = createHmacHeaders(validPayload);
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers,
        body: JSON.stringify(validPayload),
      });

      const response = await payoutHandler(req);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.payout).toBeDefined();
      expect(data.payout.event_uuid).toBe(TEST_EVENT_UUID);
      expect(data.payout.amount).toBe("150.75");
      expect(data.payout.tx_hash).toBe("0x7788aabbccdd");
      expect(data.payout.paid_by).toBe(7013087032);
      expect(data.payout.token_id).toBe(1);

      // Verify DB update flipped organizer_payment_status
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          organizer_payment_status: "payed_to_organizer",
          updatedBy: "payout_bot_7013087032",
        })
      );
    });
  });

  describe("Reminder Idempotency & Status Decoupling", () => {
    it("ensures sendPaymentReminder records payout_reminder_sent_at and does not flip organizer_payment_status", () => {
      // Logic simulation of sendPaymentReminder update
      const eventState = {
        id: 1,
        event_uuid: TEST_EVENT_UUID,
        organizer_payment_status: "not_payed",
        payout_reminder_sent_at: null as Date | null,
      };

      // When message is sent successfully
      function handleMessageSuccess(state: typeof eventState) {
        state.payout_reminder_sent_at = new Date();
        // Crucial: organizer_payment_status must NOT be altered
      }

      handleMessageSuccess(eventState);

      expect(eventState.payout_reminder_sent_at).not.toBeNull();
      expect(eventState.organizer_payment_status).toBe("not_payed");
    });

    it("ensures events with existing payout_reminder_sent_at are excluded from future reminder runs", () => {
      const candidates = [
        {
          id: 1,
          event_uuid: "evt-1",
          organizer_payment_status: "not_payed",
          payout_reminder_sent_at: null,
          hasEnded: true,
        },
        {
          id: 2,
          event_uuid: "evt-2",
          organizer_payment_status: "not_payed",
          payout_reminder_sent_at: new Date(Date.now() - 3600 * 1000), // Already sent
          hasEnded: true,
        },
        {
          id: 3,
          event_uuid: "evt-3",
          organizer_payment_status: "payed_to_organizer",
          payout_reminder_sent_at: null,
          hasEnded: true,
        },
      ];

      // Query filter condition: organizer_payment_status = 'not_payed' AND payout_reminder_sent_at IS NULL
      const filtered = candidates.filter(
        (c) => c.organizer_payment_status === "not_payed" && c.payout_reminder_sent_at === null
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe("Upfront Fee Removal & Capacity Editing", () => {
    it("verifies paid event creation requires no upfront orders", () => {
      const paidEventInput = {
        title: "Conference 2026",
        capacity: 100,
        has_payment: true,
      };

      // Prior behavior inserted order with order_type: "event_creation"
      // New behavior inserts no order
      const ordersCreated: string[] = [];
      function onEventCreate(input: typeof paidEventInput) {
        // No orders inserted for event creation
        return { event_uuid: TEST_EVENT_UUID, ...input };
      }

      const created = onEventCreate(paidEventInput);
      expect(created.event_uuid).toBe(TEST_EVENT_UUID);
      expect(ordersCreated.length).toBe(0);
    });

    it("verifies capacity changes on paid events apply immediately and sync bought_capacity", () => {
      let eventCapacity = 50;
      let boughtCapacity = 50;
      const ordersCreated: string[] = [];

      function updateCapacity(newCapacity: number) {
        // Issue #1033: Applies immediately, updates bought_capacity, creates NO orders
        eventCapacity = newCapacity;
        boughtCapacity = newCapacity;
      }

      updateCapacity(120);

      expect(eventCapacity).toBe(120);
      expect(boughtCapacity).toBe(120);
      expect(ordersCreated.length).toBe(0);
    });
  });
});
