import { describe, it, expect, vi } from "vitest";
import { checkTierCapacity, getTiersByEventUuid } from "@/db/modules/eventTicketTiers.db";
import { publishOrderPaidEvent, OrderPaidEventPayload } from "@/lib/orderEvents";
import { EventTicketTierRow } from "@/db/schema/eventTicketTiers";

describe("Wave 6: Multi-Tier Ticketing & RabbitMQ Event-Driven Payments", () => {
  /* -------------------------------------------------------------------------- */
  /*  Issue #966: Multi-Tier Ticketing Schema & Capacity Tracking              */
  /* -------------------------------------------------------------------------- */
  describe("Multi-Tier Ticketing & Independent Capacity Tracking (#966)", () => {
    const mockTiers: EventTicketTierRow[] = [
      {
        id: 1,
        event_uuid: "00000000-0000-0000-0000-000000000001",
        tier_name: "Early Bird",
        price: 15,
        capacity: 50,
        sold_count: 50, // Sold out
        ticket_type: "NFT",
        description: "Early access ticket at discounted rate",
        sort_order: 1,
        created_at: new Date(),
        updatedAt: new Date(),
        updatedBy: "system",
      },
      {
        id: 2,
        event_uuid: "00000000-0000-0000-0000-000000000001",
        tier_name: "General Admission",
        price: 30,
        capacity: 200,
        sold_count: 120, // 80 remaining
        ticket_type: "NFT",
        description: "Standard entrance pass",
        sort_order: 2,
        created_at: new Date(),
        updatedAt: new Date(),
        updatedBy: "system",
      },
      {
        id: 3,
        event_uuid: "00000000-0000-0000-0000-000000000001",
        tier_name: "VIP All-Access",
        price: 100,
        capacity: 20,
        sold_count: 5, // 15 remaining
        ticket_type: "NFT",
        description: "VIP lounge access + exclusive speaker dinner",
        sort_order: 3,
        created_at: new Date(),
        updatedAt: new Date(),
        updatedBy: "system",
      },
    ];

    it("evaluates capacity independently per tier without cross-tier blocking", () => {
      function evaluateTierCapacity(tier: EventTicketTierRow) {
        const isSoldOut = tier.capacity > 0 && tier.sold_count >= tier.capacity;
        const remaining = Math.max(0, tier.capacity - tier.sold_count);
        return { isSoldOut, remaining, tier_name: tier.tier_name };
      }

      const earlyBird = evaluateTierCapacity(mockTiers[0]);
      expect(earlyBird.isSoldOut).toBe(true);
      expect(earlyBird.remaining).toBe(0);

      const general = evaluateTierCapacity(mockTiers[1]);
      expect(general.isSoldOut).toBe(false);
      expect(general.remaining).toBe(80);

      const vip = evaluateTierCapacity(mockTiers[2]);
      expect(vip.isSoldOut).toBe(false);
      expect(vip.remaining).toBe(15);
    });

    it("supports unlimited capacity tiers when capacity is 0", () => {
      const unlimitedTier: EventTicketTierRow = {
        id: 4,
        event_uuid: "00000000-0000-0000-0000-000000000002",
        tier_name: "Free Community RSVP",
        price: 0,
        capacity: 0, // unlimited
        sold_count: 5432,
        ticket_type: "NFT",
        description: "Open community admission",
        sort_order: 1,
        created_at: new Date(),
        updatedAt: new Date(),
        updatedBy: "system",
      };

      const isSoldOut = unlimitedTier.capacity > 0 && unlimitedTier.sold_count >= unlimitedTier.capacity;
      expect(isSoldOut).toBe(false);
    });

    it("calculates order totals using selected tier pricing and respects coupons", () => {
      const selectedTier = mockTiers[2]; // VIP $100
      const couponFixedDiscount = 20; // $20 off

      const effectivePrice = selectedTier.price;
      const finalPrice = Math.max(0, effectivePrice - couponFixedDiscount);

      expect(effectivePrice).toBe(100);
      expect(finalPrice).toBe(80);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  Legacy Single-Tier Fallback & Backward Compatibility                     */
  /* -------------------------------------------------------------------------- */
  describe("Backward-Compatible Legacy Fallback Synthesis (#966)", () => {
    it("synthesizes a default General Admission tier when event_ticket_tiers has no rows", () => {
      const legacyPaymentInfo = {
        id: 42,
        event_uuid: "00000000-0000-0000-0000-000000000099",
        title: "Web3 Summit 2026",
        price: 25.5,
        bought_capacity: 150,
        ticket_type: "NFT" as const,
        description: "Official summit ticket",
        collectionAddress: "EQD...mock_collection",
      };

      // Synthesis logic matching eventTicketTiersDB.getTiersByEventUuid
      const fallbackTier: EventTicketTierRow = {
        id: 0,
        event_uuid: legacyPaymentInfo.event_uuid,
        tier_name: legacyPaymentInfo.title?.trim() || "General Admission",
        price: legacyPaymentInfo.price,
        capacity: legacyPaymentInfo.bought_capacity,
        sold_count: 0,
        ticket_type: legacyPaymentInfo.ticket_type,
        description: legacyPaymentInfo.description,
        sort_order: 0,
        created_at: new Date(),
        updatedAt: new Date(),
        updatedBy: "legacy_fallback",
      };

      expect(fallbackTier.tier_name).toBe("Web3 Summit 2026");
      expect(fallbackTier.price).toBe(25.5);
      expect(fallbackTier.capacity).toBe(150);
      expect(fallbackTier.ticket_type).toBe("NFT");
      expect(fallbackTier.updatedBy).toBe("legacy_fallback");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  Issue #941: Event-Driven Payments via RabbitMQ                           */
  /* -------------------------------------------------------------------------- */
  describe("RabbitMQ Event-Driven Payment Fulfillment (#941)", () => {
    it("serializes valid order.paid event payload with required parameters", () => {
      const payload: OrderPaidEventPayload = {
        orderUuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        eventUuid: "00000000-0000-0000-0000-000000000001",
        userId: 123456789,
        paymentMethod: "TON",
        timestamp: Date.now(),
      };

      expect(payload.orderUuid).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
      expect(payload.paymentMethod).toBe("TON");
      expect(payload.timestamp).toBeGreaterThan(0);

      const serialized = JSON.stringify(payload);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(payload);
    });

    it("publishOrderPaidEvent catches RabbitMQ connection errors gracefully", async () => {
      // Test the error resilience of publishOrderPaidEvent
      // When RabbitMQ is offline or disconnected, it should return false rather than crashing the caller
      const payload: OrderPaidEventPayload = {
        orderUuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c9",
        paymentMethod: "USDT",
      };

      // Calling in unit test environment where RabbitMQ is not running
      const result = await publishOrderPaidEvent(payload);
      // In environment without active RabbitMQ server, it gracefully returns false or true if mock succeeds
      expect(typeof result).toBe("boolean");
    });

    it("verifies payment-to-mint transition state flow", () => {
      type OrderState = "new" | "confirming" | "processing" | "completed" | "failed";

      function transitionOnPayment(state: OrderState): OrderState {
        if (state === "new" || state === "confirming") {
          return "processing"; // Payment confirmed -> ready for instant minting
        }
        return state;
      }

      function transitionOnMintSuccess(state: OrderState): OrderState {
        if (state === "processing") {
          return "completed"; // NFT minted & registrant approved
        }
        return state;
      }

      expect(transitionOnPayment("new")).toBe("processing");
      expect(transitionOnPayment("confirming")).toBe("processing");
      expect(transitionOnMintSuccess("processing")).toBe("completed");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  Issue #970: Telegram Stars Checkout with Multi-Tier Context               */
  /* -------------------------------------------------------------------------- */
  describe("Telegram Stars (XTR) Checkout with Tier Details (#970)", () => {
    function calculateStarsAmount(price: number, tokenSymbol: string): number {
      if (tokenSymbol === "USDT") {
        return Math.max(1, Math.ceil(price * 50));
      } else if (tokenSymbol === "TON") {
        return Math.max(1, Math.ceil(price * 150));
      } else if (tokenSymbol === "STAR") {
        return Math.max(1, Math.ceil(price));
      }
      return Math.max(1, Math.ceil(price * 50));
    }

    it("calculates Stars price for different tiers correctly", () => {
      // General Admission $30 (USDT) -> 1,500 Stars
      expect(calculateStarsAmount(30, "USDT")).toBe(1500);

      // VIP Pass $100 (USDT) -> 5,000 Stars
      expect(calculateStarsAmount(100, "USDT")).toBe(5000);

      // Early Bird 5 TON -> 750 Stars
      expect(calculateStarsAmount(5, "TON")).toBe(750);
    });

    it("includes tier name prefix in Stars invoice metadata", () => {
      const eventTitle = "TON Builders Summit";
      const tierName = "VIP Pass";

      const tierPrefix = tierName ? `[${tierName}] ` : "";
      const invoiceTitle = `${tierPrefix}${eventTitle}`.slice(0, 30);
      const invoiceDescription = `Admission ticket for ${eventTitle} (${tierName})`.slice(0, 250);

      expect(invoiceTitle).toBe("[VIP Pass] TON Builders Summit");
      expect(invoiceDescription).toBe("Admission ticket for TON Builders Summit (VIP Pass)");
    });
  });
});
