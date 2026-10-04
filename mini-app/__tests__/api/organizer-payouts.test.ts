import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyBotHmac } from "@/server/botHmacAuth";
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
    const payload = `${ts}.POST./api/v1/payout.${rawBody}`;
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    return new Headers({
      "Content-Type": "application/json",
      "x-signature": sig,
      "x-timestamp": ts,
      "x-api-key": secret,
    });
  }

  describe("HMAC Authentication & Security (verifyBotHmac)", () => {
    it("accepts requests with valid HMAC signature and current timestamp", async () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100", tx_hash: "tx123", paid_by: 12345 };
      const headers = createHmacHeaders(body);
      const req = new Request("http://localhost/api/v1/payout", { method: "POST", headers, body: JSON.stringify(body) });
      const res = await verifyBotHmac(req);
      expect(res).toBeNull(); // null means success
    });

    it("rejects requests when HMAC signature does not match secret", async () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100" };
      const headers = createHmacHeaders(body, Date.now(), "wrong_secret");
      const req = new Request("http://localhost/api/v1/payout", { method: "POST", headers, body: JSON.stringify(body) });
      const res = await verifyBotHmac(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it("rejects expired timestamps (>60s) to prevent replay attacks", async () => {
      const body = { event_uuid: TEST_EVENT_UUID, amount: "100" };
      const expiredTimestamp = Date.now() - 65 * 1000;
      const headers = createHmacHeaders(body, expiredTimestamp);
      const req = new Request("http://localhost/api/v1/payout", { method: "POST", headers, body: JSON.stringify(body) });
      const res = await verifyBotHmac(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it("rejects requests when only x-api-key is present (no fallback allowed)", async () => {
      const body = { event_uuid: TEST_EVENT_UUID };
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-api-key": TEST_SECRET,
      });
      const req = new Request("http://localhost/api/v1/payout", { method: "POST", headers, body: JSON.stringify(body) });
      const res = await verifyBotHmac(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
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
  describe("Payout Additional Validation", () => {
    it("returns 409 duplicate_tx for identical tx_hash", async () => {
      const validPayload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "150.75",
        tx_hash: "0x7788aabbccdd",
        paid_by: 7013087032,
        token_id: 1,
      };
      
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers: createHmacHeaders(validPayload),
        body: JSON.stringify(validPayload),
      });

      // Insert logic has been mocked to pretend we hit unique constraint or returning null
      mockTransactionFn.mockImplementationOnce(async () => null);

      const response = await payoutHandler(req);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("duplicate_tx");
    });

    it("returns 400 for bad tx_hash", async () => {
      const payload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "150.75",
        tx_hash: "invalid-hash", // not 64 hex or 43 base64 chars
        paid_by: 7013087032,
      };
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers: createHmacHeaders(payload),
        body: JSON.stringify(payload),
      });
      const response = await payoutHandler(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("validation_error");
    });

    it("returns 400 for non-paid event", async () => {
      mockFindFirstFn.mockImplementationOnce(async ({ where }: any) => {
        // Mock non-paid event
        return { event_uuid: TEST_EVENT_UUID, has_payment: false };
      });

      const payload = {
        event_uuid: TEST_EVENT_UUID,
        amount: "100.00",
        tx_hash: "a".repeat(64),
        paid_by: 7013087032,
      };
      const req = new Request("http://localhost:3000/api/v1/payout", {
        method: "POST",
        headers: createHmacHeaders(payload),
        body: JSON.stringify(payload),
      });
      const response = await payoutHandler(req);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("bad_request");
    });
  });

  describe("sendPaymentReminder", () => {
    it("sets payout_reminder_sent_at without altering organizer_payment_status, and skips when no message_id", async () => {
      const { sendPaymentReminder } = await import("@/cronJobs/tasks/sendPaymentReminder");
      
      const mockSendLogNotification = vi.fn();
      vi.mock("@/server/utils/telegramTools", () => ({
        sendLogNotification: mockSendLogNotification,
      }));

      // Mock database queries
      const mockDbUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn() }) }) });
      mockDb.update = mockDbUpdate;
      
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([{
                events: { event_uuid: "123", title: "Test Event" },
                event_payment_info: { price: 1, bought_capacity: 10, ticket_type: "NFT", recipient_address: "address" },
              }]),
            }),
          }),
          where: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue([{ nft_count: 5 }]) }),
        }),
      });

      // 1. message_id returned -> updates payout_reminder_sent_at
      mockSendLogNotification.mockResolvedValueOnce({ message_id: 999 });
      await sendPaymentReminder();
      expect(mockDbUpdate).toHaveBeenCalled();
      const setCall = mockDbUpdate().set.mock.calls[0][0];
      expect(setCall).toHaveProperty("payout_reminder_sent_at");
      expect(setCall).not.toHaveProperty("organizer_payment_status");

      mockDbUpdate.mockClear();

      // 2. no message_id -> doesn't update marker
      mockSendLogNotification.mockResolvedValueOnce(null);
      await sendPaymentReminder();
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });
});
});
