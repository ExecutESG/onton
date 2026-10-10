import { describe, it, expect } from "vitest";
import { EventDataSchema, UpdateEventDataSchema } from "../../src/types";
import { hardCodedHubs } from "../../src/constants";
import { findUserClaimedTonSocietyBadges } from "../../src/db/modules/rewards.db";

describe("Issue #1035: Remove TON Society integration", () => {
  const baseEventPayload = {
    type: 1,
    title: "Community Meetup 2026",
    subtitle: "A decentralized gathering",
    description: "Join us for our community meetup with great discussions and workshops.",
    location: "Online",
    eventLocationType: "online" as const,
    image_url: "https://example.com/banner.png",
    start_date: 1700000000,
    end_date: 1700003600,
    timezone: "UTC",
    owner: 42,
    has_registration: false,
    has_approval: false,
    capacity: null,
    has_waiting_list: false,
    category_id: 1,
    dynamic_fields: [],
  };

  it("EventDataSchema successfully parses without society_hub", () => {
    const parsed = EventDataSchema.parse(baseEventPayload);
    expect((parsed as Record<string, unknown>).society_hub).toBeUndefined();
    expect(parsed.title).toBe("Community Meetup 2026");
  });

  it("EventDataSchema strips legacy society_hub if provided by old clients", () => {
    const legacyPayload = {
      ...baseEventPayload,
      society_hub: {
        id: "33",
        name: "Onton",
      },
    };
    const parsed = EventDataSchema.parse(legacyPayload);
    expect((parsed as Record<string, unknown>).society_hub).toBeUndefined();
    expect(parsed.title).toBe("Community Meetup 2026");
  });

  it("UpdateEventDataSchema successfully parses without society_hub", () => {
    const updatePayload = {
      type: 1,
      title: "Updated Meetup Title",
      subtitle: "Updated subtitle",
      description: "Updated description that is long enough for the validation schema.",
      location: "In Person",
      image_url: "https://example.com/new-banner.png",
      owner: 42,
      start_date: 1700000000,
      end_date: 1700003600,
      timezone: "UTC",
      category_id: 1,
      has_approval: false,
      capacity: 100,
      has_waiting_list: false,
      dynamic_fields: [],
    };
    const parsed = UpdateEventDataSchema.parse(updatePayload);
    expect((parsed as Record<string, unknown>).society_hub).toBeUndefined();
    expect(parsed.title).toBe("Updated Meetup Title");
  });

  it("EventDataSchema rejects ticket_type TSCSBT for new paid events", () => {
    const paidTscsbtPayload = {
      ...baseEventPayload,
      has_web3: true,
      ts_reward_url: "https://example.com/badge.png",
      paid_event: {
        has_payment: true,
        has_nft: true,
        ticket_type: "TSCSBT" as const,
        payment_recipient_address: "0:0000000000000000000000000000000000000000000000000000000000000000",
        token_id: 1,
        payment_amount: 1,
        nft_title: "VIP Ticket",
        nft_description: "Access pass",
        nft_image_url: "https://example.com/ticket.png",
        nft_video_url: "https://example.com/ticket.mp4",
      },
    };

    const result = EventDataSchema.safeParse(paidTscsbtPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "paid_event.ticket_type"
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("TSCSBT ticket type is deprecated");
    }
  });

  it("EventDataSchema accepts valid NFT paid events", () => {
    const paidNftPayload = {
      ...baseEventPayload,
      has_web3: true,
      ts_reward_url: "https://example.com/badge.png",
      paid_event: {
        has_payment: true,
        has_nft: true,
        ticket_type: "NFT" as const,
        payment_recipient_address: "0:0000000000000000000000000000000000000000000000000000000000000000",
        token_id: 1,
        payment_amount: 1,
        nft_title: "VIP Ticket",
        nft_description: "Access pass",
        nft_image_url: "https://example.com/ticket.png",
      },
    };

    const result = EventDataSchema.safeParse(paidNftPayload);
    expect(result.success).toBe(true);
  });

  it("hardCodedHubs returns predefined hubs without network dependence", () => {
    expect(hardCodedHubs).toBeInstanceOf(Array);
    expect(hardCodedHubs.length).toBeGreaterThan(0);
    const ontonHub = hardCodedHubs.find((h) => h.id === "33");
    expect(ontonHub).toBeDefined();
    expect(ontonHub?.name).toBe("Onton");
  });

  it("findUserClaimedTonSocietyBadges function is preserved for historical badges display", () => {
    expect(typeof findUserClaimedTonSocietyBadges).toBe("function");
  });
});
