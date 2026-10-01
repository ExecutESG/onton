import { describe, it, expect } from "vitest";
import { EventDataSchema, UpdateEventDataSchema } from "@/types";
import { rewardStepValidation } from "@/zodSchema/event/validation";

describe("Web3 & SBT Toggle Event Creation Validation", () => {
  const baseEventPayload = {
    type: 0,
    title: "Web2 Community Meetup",
    subtitle: "A simple meetup without crypto friction",
    description: "Join us for our monthly offline meetup in downtown! Coffee and tea provided.",
    image_url: "https://storage.onton.live/onton/event/cover.png",
    location: "Tehran, Valiasr St.",
    eventLocationType: "in_person" as const,
    countryId: 1,
    cityId: 10,
    owner: 12345,
    start_date: 1770000000,
    end_date: 1770007200,
    timezone: "GMT+3:30",
    dynamic_fields: [],
    has_registration: true,
    has_approval: false,
    capacity: 50,
    has_waiting_list: false,
    category_id: 1,
    paid_event: {
      has_payment: false,
    },
  };

  it("should successfully validate a pure Web2 event (has_web3: false) without SBT reward URLs", () => {
    const payload = {
      ...baseEventPayload,
      has_web3: false,
    };

    const parsed = EventDataSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.has_web3).toBe(false);
      expect(parsed.data.ts_reward_url).toBeUndefined();
    }
  });

  it("should successfully validate an on-chain Web3 event (has_web3: true) with SBT reward URLs", () => {
    const payload = {
      ...baseEventPayload,
      has_web3: true,
      ts_reward_url: "https://storage.onton.live/onton/sbt/badge.png",
      video_url: "https://storage.onton.live/onton/sbt/badge.mp4",
    };

    const parsed = EventDataSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.has_web3).toBe(true);
      expect(parsed.data.ts_reward_url).toBe("https://storage.onton.live/onton/sbt/badge.png");
    }
  });

  it("should fail validation if has_web3 is true but ts_reward_url is missing", () => {
    const payload = {
      ...baseEventPayload,
      has_web3: true,
    };

    const parsed = EventDataSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.ts_reward_url).toBeDefined();
      expect(fieldErrors.ts_reward_url?.[0]).toContain("Reward badge image is required when Web3 features are enabled");
    }
  });

  it("should respect hasWeb3 flag in rewardStepValidation schema", () => {
    // When Web3 is false, reward URLs are optional
    const web2RewardSchema = rewardStepValidation(false, true, false, false);
    const validWeb2Step = web2RewardSchema.safeParse({});
    expect(validWeb2Step.success).toBe(true);

    // When Web3 is true, reward image URL is required
    const web3RewardSchema = rewardStepValidation(false, true, false, true);
    const invalidWeb3Step = web3RewardSchema.safeParse({});
    expect(invalidWeb3Step.success).toBe(false);
  });

  it("should validate UpdateEventDataSchema with has_web3", () => {
    const updatePayload = {
      ...baseEventPayload,
      event_id: 42,
      event_uuid: "11111111-2222-3333-4444-555555555555",
      has_web3: false,
    };

    const parsed = UpdateEventDataSchema.safeParse(updatePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.has_web3).toBe(false);
    }
  });
});
