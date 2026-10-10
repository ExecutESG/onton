import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseInvoicePayload,
  calculateExpectedStars,
} from "../../../telegram-bot/src/handlers/starsPaymentHandler";

describe("Issue #1046: Atomic Tier Inventory & Row-Level Locking (F-34)", () => {
  describe("Capacity & Sold-Out Logic", () => {
    it("determines sold out correctly when sold_count >= capacity (> 0)", () => {
      const isSoldOut = (capacity: number, soldCount: number) => {
        return capacity > 0 && soldCount >= capacity;
      };

      expect(isSoldOut(10, 9)).toBe(false);
      expect(isSoldOut(10, 10)).toBe(true);
      expect(isSoldOut(10, 11)).toBe(true);
    });

    it("treats capacity 0 or null as unlimited capacity (never sold out)", () => {
      const isSoldOut = (capacity: number, soldCount: number) => {
        return capacity > 0 && soldCount >= capacity;
      };

      expect(isSoldOut(0, 0)).toBe(false);
      expect(isSoldOut(0, 500)).toBe(false);
    });

    it("guarantees decrementing sold_count never drops below zero", () => {
      const decrementSoldCount = (current: number, delta: number) => {
        return Math.max(0, current - delta);
      };

      expect(decrementSoldCount(5, 1)).toBe(4);
      expect(decrementSoldCount(1, 1)).toBe(0);
      expect(decrementSoldCount(0, 1)).toBe(0);
      expect(decrementSoldCount(2, 5)).toBe(0);
    });
  });

  describe("Concurrent Reservation & Locking Simulation", () => {
    it("simulates atomic check-and-increment under concurrent checkout attempts", async () => {
      // Shared in-memory tier inventory state simulating DB row
      const tier = {
        id: 42,
        capacity: 2,
        sold_count: 0,
      };

      // Simulates transactional lockAndCheckTierCapacityTrx + incrementTierSoldCountTrx
      let lockQueue: Promise<void> = Promise.resolve();

      const attemptReservation = async (userId: number): Promise<{ success: boolean; error?: string }> => {
        // Enqueue transaction to simulate row-level lock (SELECT ... FOR UPDATE)
        const currentLock = lockQueue;
        let releaseLock: () => void = () => {};
        lockQueue = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });

        await currentLock;
        try {
          if (tier.capacity > 0 && tier.sold_count >= tier.capacity) {
            return { success: false, error: "TIER_SOLD_OUT" };
          }
          tier.sold_count += 1;
          return { success: true };
        } finally {
          releaseLock();
        }
      };

      // Launch 5 concurrent buyers for only 2 tickets
      const results = await Promise.all([
        attemptReservation(101),
        attemptReservation(102),
        attemptReservation(103),
        attemptReservation(104),
        attemptReservation(105),
      ]);

      const successfulReservations = results.filter((r) => r.success);
      const rejectedReservations = results.filter((r) => !r.success);

      expect(successfulReservations).toHaveLength(2);
      expect(rejectedReservations).toHaveLength(3);
      expect(tier.sold_count).toBe(2);
      rejectedReservations.forEach((r) => {
        expect(r.error).toBe("TIER_SOLD_OUT");
      });
    });
  });
});

describe("Issue #1045: Telegram Stars Pre-Checkout Query & Payment Validation (F-33)", () => {
  describe("parseInvoicePayload", () => {
    it("parses plain UUID string correctly", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parseInvoicePayload(uuid);
      expect(result.orderUuid).toBe(uuid);
    });

    it("parses JSON payload containing order_uuid", () => {
      const payload = JSON.stringify({
        order_uuid: "550e8400-e29b-41d4-a716-446655440000",
        tier_id: 12,
      });
      const result = parseInvoicePayload(payload);
      expect(result.orderUuid).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("parses JSON payload containing order_id or uuid", () => {
      const payload = JSON.stringify({
        order_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      const result = parseInvoicePayload(payload);
      expect(result.orderUuid).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("returns null for malformed or non-UUID strings", () => {
      expect(parseInvoicePayload("not-a-valid-uuid").orderUuid).toBeNull();
      expect(parseInvoicePayload("").orderUuid).toBeNull();
      expect(parseInvoicePayload("{ invalid json }").orderUuid).toBeNull();
      expect(parseInvoicePayload(null as any).orderUuid).toBeNull();
    });
  });

  describe("calculateExpectedStars", () => {
    it("calculates Stars for USDT (50 Stars/USDT with minimum 1)", () => {
      expect(calculateExpectedStars(1, "USDT")).toBe(50);
      expect(calculateExpectedStars(2.5, "USDT")).toBe(125);
      expect(calculateExpectedStars(0.01, "USDT")).toBe(1);
    });

    it("calculates Stars for TON (150 Stars/TON with minimum 1)", () => {
      expect(calculateExpectedStars(1, "TON")).toBe(150);
      expect(calculateExpectedStars(0.5, "TON")).toBe(75);
      expect(calculateExpectedStars(0.001, "TON")).toBe(1);
    });

    it("calculates Stars 1:1 for STAR currency", () => {
      expect(calculateExpectedStars(100, "STAR")).toBe(100);
      expect(calculateExpectedStars(1, "STAR")).toBe(1);
    });
  });

  describe("Pre-Checkout Validation Engine", () => {
    // Pure validator simulating handleStarsPreCheckout logic
    interface PreCheckoutQueryMock {
      id: string;
      invoice_payload: string;
      total_amount: number;
    }

    interface OrderMock {
      uuid: string;
      state: "new" | "confirming" | "completed" | "cancelled" | "failed";
      total_price: number;
      token_symbol?: string | null;
      tier_id?: number | null;
      tier_capacity?: number | null;
      tier_sold_count?: number | null;
      tier_name?: string | null;
      event_capacity?: number | null;
      event_sold_total?: number | null;
    }

    const validatePreCheckout = (
      query: PreCheckoutQueryMock,
      order: OrderMock | null
    ): { ok: boolean; error_message?: string } => {
      const { orderUuid } = parseInvoicePayload(query.invoice_payload);
      if (!orderUuid) {
        return { ok: false, error_message: "Invalid ticket order. Please restart the checkout from the event page." };
      }

      if (!order) {
        return { ok: false, error_message: "Order not found. Please create a new ticket order." };
      }

      if (order.state === "completed") {
        return { ok: false, error_message: "This order has already been paid and processed." };
      }

      if (order.state !== "new" && order.state !== "confirming") {
        return { ok: false, error_message: "This order is no longer valid. Please start a new purchase." };
      }

      if (order.tier_id && order.tier_capacity !== null && order.tier_capacity !== undefined && order.tier_capacity > 0) {
        if ((order.tier_sold_count ?? 0) >= order.tier_capacity) {
          return { ok: false, error_message: `The "${order.tier_name || "selected"}" ticket tier is sold out.` };
        }
      }

      if (order.event_capacity !== null && order.event_capacity !== undefined && order.event_capacity > 0) {
        if ((order.event_sold_total ?? 0) >= order.event_capacity) {
          return { ok: false, error_message: "This event has reached full capacity." };
        }
      }

      const expectedStars = calculateExpectedStars(order.total_price, order.token_symbol);
      if (query.total_amount < expectedStars) {
        return { ok: false, error_message: "Payment amount does not match ticket price." };
      }

      return { ok: true };
    };

    it("approves valid pre_checkout_query when tier has capacity and price matches", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "confirming",
        total_price: 2,
        token_symbol: "USDT",
        tier_id: 1,
        tier_capacity: 10,
        tier_sold_count: 5,
        tier_name: "VIP",
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-1",
        invoice_payload: order.uuid,
        total_amount: 100, // 2 USDT * 50 = 100 Stars
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(true);
      expect(res.error_message).toBeUndefined();
    });

    it("rejects when order does not exist", () => {
      const query: PreCheckoutQueryMock = {
        id: "pcq-2",
        invoice_payload: "550e8400-e29b-41d4-a716-446655440000",
        total_amount: 100,
      };

      const res = validatePreCheckout(query, null);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain("Order not found");
    });

    it("rejects when order is already completed", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "completed",
        total_price: 1,
        token_symbol: "USDT",
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-3",
        invoice_payload: order.uuid,
        total_amount: 50,
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain("already been paid");
    });

    it("rejects when order is cancelled or failed", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "cancelled",
        total_price: 1,
        token_symbol: "USDT",
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-4",
        invoice_payload: order.uuid,
        total_amount: 50,
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain("no longer valid");
    });

    it("rejects when tier sold_count >= tier capacity", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "confirming",
        total_price: 1,
        token_symbol: "USDT",
        tier_id: 1,
        tier_capacity: 10,
        tier_sold_count: 10,
        tier_name: "Early Bird",
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-5",
        invoice_payload: order.uuid,
        total_amount: 50,
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain('The "Early Bird" ticket tier is sold out.');
    });

    it("rejects when overall event capacity is exceeded", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "confirming",
        total_price: 1,
        token_symbol: "USDT",
        event_capacity: 50,
        event_sold_total: 50,
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-6",
        invoice_payload: order.uuid,
        total_amount: 50,
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain("event has reached full capacity");
    });

    it("rejects when Stars paid amount is less than expected price", () => {
      const order: OrderMock = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        state: "confirming",
        total_price: 2,
        token_symbol: "TON", // 2 TON * 150 = 300 Stars
      };

      const query: PreCheckoutQueryMock = {
        id: "pcq-7",
        invoice_payload: order.uuid,
        total_amount: 150, // underpaid!
      };

      const res = validatePreCheckout(query, order);
      expect(res.ok).toBe(false);
      expect(res.error_message).toContain("Payment amount does not match ticket price");
    });
  });
});
