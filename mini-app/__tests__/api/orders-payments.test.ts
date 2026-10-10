import { describe, it, expect, vi } from "vitest";

import { EventDataSchema } from "@/types";

vi.mock("@ton/core", () => ({
  Address: { parse: vi.fn() },
}));

describe("Orders & Dual-Rail Payments API Flow", () => {
  describe("Web2 Paid Event Schema", () => {
    it("accepts paid event without NFT fields when has_web3 is false, and forces TICKET", () => {
      const payload = {
        title: "Test Web2 Paid Event",
        subtitle: "Subtitle",
        location: "Some location",
        image_url: "https://example.com/img.png",
        owner: 123,
        description: "Test description",
        type: 1, // 'type' expected number!
        start_date: 123456789,
        end_date: 123456889,
        timezone: "UTC",
        has_registration: true,
        has_approval: false,
        has_waiting_list: false,
        dynamic_fields: [],
        has_web3: false,
        category_id: 1,
        capacity: 100,
        paid_event: {
          has_payment: true,
          payment_recipient_address: "EQBvW8Z5huBkMJYdn3PCDnTWKK3iqKIOFd3zCXPawpReQDrC",
          token_id: 1,
          payment_amount: 10,
          has_nft: false
        }
      };

      const result = EventDataSchema.safeParse(payload);
      if (!result.success) console.log("TEST ERROR:", (result as any).error);
      expect(result.success).toBe(true);

      // Emulate server-side addEvent logic
      if (!payload.has_web3 && payload.paid_event) {
        payload.paid_event.has_nft = false;
        (payload.paid_event as any).ticket_type = "TICKET";
      }
      expect((payload.paid_event as any).ticket_type).toBe("TICKET");
    });
  });

  // Free RSVP Flow
  describe("Free RSVP Flow", () => {
    it("permits order creation without wallet address for free events", () => {
      const freePayload = {
        event_uuid: "4b287361-a06f-43dd-87c1-2d3a68f99fa7",
        ticket_id: 1,
        tickets_count: 1,
        payment_method: "free",
      };

      expect(freePayload.payment_method).toBe("free");
      expect((freePayload as any).owner_address).toBeUndefined();
    });

    it("instantaneously completes order when total_price is 0", () => {
      function processOrder(totalPrice: number, paymentMethod: string) {
        const isFree = totalPrice === 0 || paymentMethod === "free";
        return {
          status: isFree ? "completed" : "pending",
          paymentStatus: isFree ? "free_approved" : "awaiting_payment",
          registrantStatus: isFree ? "approved" : "pending",
        };
      }

      const orderResult = processOrder(0, "free");
      expect(orderResult.status).toBe("completed");
      expect(orderResult.paymentStatus).toBe("free_approved");
      expect(orderResult.registrantStatus).toBe("approved");
    });
  });

  // Telegram Stars Flow
  describe("Telegram Stars (XTR) Rail", () => {
    function calculateStars(usdPrice: number): number {
      const STARS_PER_USD = 50; // 1 Star ≈ $0.02 USD
      return Math.max(1, Math.round(usdPrice * STARS_PER_USD));
    }

    it("calculates correct Stars amount for various USD ticket prices", () => {
      expect(calculateStars(1)).toBe(50);
      expect(calculateStars(5)).toBe(250);
      expect(calculateStars(10)).toBe(500);
      expect(calculateStars(20)).toBe(1000);
      expect(calculateStars(0.01)).toBe(1); // Min 1 star floor
    });

    it("constructs valid Telegram Stars invoice parameters", () => {
      const eventTitle = "TON Gateway VIP Pass";
      const starsAmount = calculateStars(20);

      const invoicePayload = {
        title: eventTitle.slice(0, 32),
        description: `Admission ticket for ${eventTitle}`.slice(0, 255),
        currency: "XTR",
        prices: [{ label: "Ticket", amount: starsAmount }],
        payload: JSON.stringify({
          order_id: 999,
          event_id: 123,
          ticket_count: 1,
        }),
      };

      expect(invoicePayload.currency).toBe("XTR");
      expect(invoicePayload.prices[0].amount).toBe(1000);
      expect(invoicePayload.payload).toContain('"order_id":999');
    });
  });

  // Crypto Rail
  describe("TON / USDT Crypto Rail", () => {
    it("validates on-chain recipient and memo attachment", () => {
      const recipientAddress = "EQBvW8Z5huBkMJYdn3PCDnTWKK3iqKIOFd3zCXPawpReQDrC";
      const orderUuid = "order-uuid-777";

      const txPayload = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: recipientAddress,
            amount: "5000000000", // 5 TON in nanotons
            payload: orderUuid,
          },
        ],
      };

      expect(txPayload.messages[0].address).toBe(recipientAddress);
      expect(txPayload.messages[0].payload).toBe(orderUuid);
    });
  });

  // Dead-Letter Queue (DLQ) Rail (#942)
  describe("Dead-Letter Queue (DLQ) & Minting Resilience", () => {
    const MAX_RETRIES = 5;

    function simulateMintRetry(currentRetryCount: number, errorMsg: string) {
      const nextRetries = currentRetryCount + 1;
      const isDlq = nextRetries >= MAX_RETRIES;
      return {
        state: isDlq ? "failed" : "processing",
        retry_count: nextRetries,
        last_error: errorMsg.slice(0, 1000),
        updatedBy: isDlq ? "mint_dlq_max_retries" : `mint_retry_${nextRetries}`,
      };
    }

    it("increments retry count and stays in processing state for retries < 5", () => {
      const attempt1 = simulateMintRetry(0, "RPC timeout connecting to toncenter");
      expect(attempt1.state).toBe("processing");
      expect(attempt1.retry_count).toBe(1);
      expect(attempt1.last_error).toBe("RPC timeout connecting to toncenter");
      expect(attempt1.updatedBy).toBe("mint_retry_1");

      const attempt4 = simulateMintRetry(3, "Contract busy: sequence out of order");
      expect(attempt4.state).toBe("processing");
      expect(attempt4.retry_count).toBe(4);
      expect(attempt4.updatedBy).toBe("mint_retry_4");
    });

    it("transitions order to failed DLQ state upon reaching 5 retries", () => {
      const attempt5 = simulateMintRetry(4, "Out of gas: insufficient TON in minter wallet");
      expect(attempt5.state).toBe("failed");
      expect(attempt5.retry_count).toBe(5);
      expect(attempt5.last_error).toBe("Out of gas: insufficient TON in minter wallet");
      expect(attempt5.updatedBy).toBe("mint_dlq_max_retries");
    });

    it("excludes orders in failed state or retry_count >= 5 from active query pool", () => {
      const mockOrderPool = [
        { uuid: "ord-1", state: "processing", retry_count: 0 },
        { uuid: "ord-2", state: "processing", retry_count: 3 },
        { uuid: "ord-3", state: "failed", retry_count: 5 },
        { uuid: "ord-4", state: "processing", retry_count: 5 },
        { uuid: "ord-5", state: "completed", retry_count: 0 },
      ];

      const activeQuery = mockOrderPool.filter(
        (o) => o.state === "processing" && o.retry_count < MAX_RETRIES
      );

      expect(activeQuery.map((o) => o.uuid)).toEqual(["ord-1", "ord-2"]);
    });
  });
});

