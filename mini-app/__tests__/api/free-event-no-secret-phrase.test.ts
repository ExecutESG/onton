import { describe, it, expect } from "vitest";
import { EventDataSchema } from "@/types";

describe("Free event creation without secret_phrase validation", () => {
  const baseFreeEventPayload = {
    type: 0,
    title: "Free Community Meetup",
    subtitle: "Lu.ma-style 3-step event creation",
    description: "Join us for our community gathering without registration or ticket gating.",
    image_url: "https://storage.onton.live/onton/event/cover.png",
    location: "Online",
    eventLocationType: "online" as const,
    owner: 12345,
    start_date: 1770000000,
    end_date: 1770007200,
    timezone: "UTC",
    dynamic_fields: [],
    has_registration: false,
    has_approval: false,
    capacity: null,
    has_waiting_list: false,
    category_id: 1,
    has_web3: false,
    paid_event: {
      has_payment: false,
    },
  };

  it("successfully validates a free event with has_registration: false, paid_event.has_payment: false, and no secret_phrase", () => {
    // Omitting secret_phrase completely
    const result = EventDataSchema.safeParse(baseFreeEventPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.has_registration).toBe(false);
      expect(result.data.paid_event?.has_payment).toBe(false);
      expect(result.data.secret_phrase).toBeUndefined();
    }
  });

  it("successfully validates when secret_phrase is explicitly undefined", () => {
    const payload = {
      ...baseFreeEventPayload,
      secret_phrase: undefined,
    };

    const result = EventDataSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secret_phrase).toBeUndefined();
    }
  });

  it("successfully validates in-person free event with registration disabled and no secret_phrase", () => {
    const payload = {
      ...baseFreeEventPayload,
      eventLocationType: "in_person" as const,
      location: "San Francisco, CA",
      countryId: 1,
      cityId: 1,
    };

    const result = EventDataSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.has_registration).toBe(false);
      expect(result.data.secret_phrase).toBeUndefined();
    }
  });
});
