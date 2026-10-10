import { describe, it, expect } from "vitest";
import { EventDataSchema, UpdateEventDataSchema, EventRegisterSchema } from "@/types";

describe("Capacity Validation for In-Person Events", () => {
  const baseEvent = {
    type: 1,
    title: "In-Person Meetup",
    subtitle: "Tech Talk",
    description: "Meetup description",
    location: "Tehran, Iran",
    eventLocationType: "in_person" as const,
    image_url: "https://example.com/image.jpg",
    has_web3: false,
    owner: 1,
    start_date: 1700000000,
    end_date: 1700003600,
    timezone: "Asia/Tehran",
    dynamic_fields: [],
    has_registration: true,
    has_approval: false,
    has_waiting_list: false,
    category_id: 1,
  };

  it("rejects in-person registered event creation with null capacity", () => {
    const parsed = EventDataSchema.safeParse({
      ...baseEvent,
      has_registration: true,
      capacity: null,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.capacity).toBeDefined();
    }
  });

  it("rejects in-person registered event creation with 0 or negative capacity", () => {
    const parsed = EventDataSchema.safeParse({
      ...baseEvent,
      has_registration: true,
      capacity: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts in-person registered event creation with valid positive capacity", () => {
    const parsed = EventDataSchema.safeParse({
      ...baseEvent,
      has_registration: true,
      capacity: 50,
    });
    expect(parsed.success).toBe(true);
  });

  it("allows in-person event creation without registration even if capacity is null", () => {
    const parsed = EventDataSchema.safeParse({
      ...baseEvent,
      has_registration: false,
      capacity: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("allows online event creation with null capacity", () => {
    const parsed = EventDataSchema.safeParse({
      ...baseEvent,
      eventLocationType: "online",
      has_registration: true,
      capacity: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects in-person registered event update with null capacity", () => {
    const parsed = UpdateEventDataSchema.safeParse({
      ...baseEvent,
      has_registration: true,
      capacity: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("allows in-person event update without registration even if capacity is null", () => {
    const parsed = UpdateEventDataSchema.safeParse({
      ...baseEvent,
      has_registration: false,
      capacity: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Simplified EventRegisterSchema", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("validates with full_name only (company, position, notes optional)", () => {
    const parsed = EventRegisterSchema.safeParse({
      event_uuid: validUuid,
      full_name: "Mahdi Farimani",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid event UUID format", () => {
    const parsed = EventRegisterSchema.safeParse({
      event_uuid: "not-a-valid-uuid",
      full_name: "Mahdi Farimani",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.event_uuid).toBeDefined();
    }
  });

  it("rejects when full_name is too short", () => {
    const parsed = EventRegisterSchema.safeParse({
      event_uuid: validUuid,
      full_name: "M",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts optional company, position, and notes", () => {
    const parsed = EventRegisterSchema.safeParse({
      event_uuid: validUuid,
      full_name: "Mahdi Farimani",
      company: "ExecutESG",
      position: "Senior Lead",
      notes: "Looking forward to attending!",
    });
    expect(parsed.success).toBe(true);
  });
});
