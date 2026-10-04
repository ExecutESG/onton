import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const mockState = vi.hoisted(() => ({
  mockUser: {
    user_id: 1,
    role: "organizer",
    created_at: new Date(),
    limits_override: null as any,
  },
  mockPastEventWithCheckIn: false,
  mockEventsCreatedLast24Hours: 0,
  mockUpcomingEventsCount: 0,
}));

vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    cacheKeys: {
      user: "user:",
      userWallet: "userWallet:",
    },
    cacheLvl: {
      long: 3600,
    },
    getCache: vi.fn().mockImplementation(async () => mockState.mockUser),
    setCache: vi.fn().mockResolvedValue(undefined),
    deleteCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/db/modules/userIdentities.db", () => ({
  ensureUserIdentitiesTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              execute: vi.fn().mockImplementation(async () => {
                return mockState.mockPastEventWithCheckIn ? [{ exists: 1 }] : [];
              }),
            }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockImplementation(async () => {
            return [{ count: mockState.mockEventsCreatedLast24Hours }];
          }),
        }),
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          execute: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

import {
  determineOrganizerTier,
  computeEffectiveLimits,
  calculateAccountAgeDays,
  assertCanCreateEvent,
  assertCanUpdateEvent,
  setOrganizerLimitsOverride,
} from "@/services/organizerLimits";

describe("organizerLimits Tier Logic & Enforcement (Issue #1031)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.mockUser.user_id = 1;
    mockState.mockUser.role = "organizer";
    mockState.mockUser.created_at = new Date();
    mockState.mockUser.limits_override = null;
    mockState.mockPastEventWithCheckIn = false;
    mockState.mockEventsCreatedLast24Hours = 0;
    mockState.mockUpcomingEventsCount = 0;
  });

  describe("Tier Calculations", () => {
    it("should classify account < 7 days as 'new' tier", () => {
      expect(determineOrganizerTier(0, false)).toBe("new");
      expect(determineOrganizerTier(5, false)).toBe("new");
      expect(determineOrganizerTier(6, true)).toBe("new");

      const limits = computeEffectiveLimits("organizer", "new", null);
      expect(limits).toEqual({
        eventsPerDay: 2,
        maxUpcoming: 5,
        maxCapacity: 500,
      });
    });

    it("should classify account between 7 and 30 days without past check-ins as 'new' tier", () => {
      expect(determineOrganizerTier(7, false)).toBe("new");
      expect(determineOrganizerTier(15, false)).toBe("new");
      expect(determineOrganizerTier(29, false)).toBe("new");
    });

    it("should classify account with past check-in attendee (>= 7 days) as 'trusted' tier", () => {
      expect(determineOrganizerTier(7, true)).toBe("trusted");
      expect(determineOrganizerTier(15, true)).toBe("trusted");

      const limits = computeEffectiveLimits("organizer", "trusted", null);
      expect(limits).toEqual({
        eventsPerDay: 20,
        maxUpcoming: null,
        maxCapacity: null,
      });
    });

    it("should classify account >= 30 days as 'trusted' tier even without past check-ins", () => {
      expect(determineOrganizerTier(30, false)).toBe("trusted");
      expect(determineOrganizerTier(60, false)).toBe("trusted");

      const limits = computeEffectiveLimits("organizer", "trusted", null);
      expect(limits.eventsPerDay).toBe(20);
      expect(limits.maxUpcoming).toBeNull();
      expect(limits.maxCapacity).toBeNull();
    });
  });

  describe("Admin Exemption", () => {
    it("should give unlimited limits to admin role", () => {
      const limits = computeEffectiveLimits("admin", "new", null);
      expect(limits).toEqual({
        eventsPerDay: Infinity,
        maxUpcoming: null,
        maxCapacity: null,
      });
    });
  });

  describe("Override Precedence", () => {
    it("should prioritize limits_override over tier defaults", () => {
      const override = {
        eventsPerDay: 50,
        maxCapacity: 2500,
        maxUpcoming: 15,
      };

      const limits = computeEffectiveLimits("organizer", "new", override);
      expect(limits.eventsPerDay).toBe(50);
      expect(limits.maxCapacity).toBe(2500);
      expect(limits.maxUpcoming).toBe(15);
    });

    it("should allow partial override fields with fallback to tier defaults", () => {
      const override = {
        maxCapacity: 1500,
      };

      const limits = computeEffectiveLimits("organizer", "new", override);
      expect(limits.maxCapacity).toBe(1500);
      expect(limits.eventsPerDay).toBe(2); // new tier default
      expect(limits.maxUpcoming).toBe(5); // new tier default
    });
  });

  describe("Creation Limit Enforcement (assertCanCreateEvent)", () => {
    it("should allow event creation within limits for new tier", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days old
      mockState.mockPastEventWithCheckIn = false;
      mockState.mockEventsCreatedLast24Hours = 1;
      mockState.mockUpcomingEventsCount = 3;

      await expect(
        assertCanCreateEvent(1, { capacity: 400 })
      ).resolves.not.toThrow();
    });

    it("should block 3rd event creation in 24 hours for new tier", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockState.mockPastEventWithCheckIn = false;
      mockState.mockEventsCreatedLast24Hours = 2; // already created 2 events

      await expect(
        assertCanCreateEvent(1, { capacity: 100 })
      ).rejects.toThrowError(TRPCError);

      await expect(
        assertCanCreateEvent(1, { capacity: 100 })
      ).rejects.toThrow(/Daily event creation limit reached/);
    });

    it("should block capacity > 500 for new tier", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockState.mockPastEventWithCheckIn = false;
      mockState.mockEventsCreatedLast24Hours = 0;
      mockState.mockUpcomingEventsCount = 0;

      await expect(
        assertCanCreateEvent(1, { capacity: 501 })
      ).rejects.toThrowError(TRPCError);

      await expect(
        assertCanCreateEvent(1, { capacity: 501 })
      ).rejects.toThrow(/exceeds allowed limit of 500/);
    });

    it("should allow capacity > 500 when admin override is present", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockState.mockUser.limits_override = { maxCapacity: 2000, eventsPerDay: 10 };
      mockState.mockEventsCreatedLast24Hours = 2;

      await expect(
        assertCanCreateEvent(1, { capacity: 1500 })
      ).resolves.not.toThrow();
    });
  });

  describe("Update Limit Enforcement (assertCanUpdateEvent)", () => {
    it("should allow updating event capacity when within limit", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockState.mockPastEventWithCheckIn = false;

      await expect(
        assertCanUpdateEvent(1, { capacity: 450 })
      ).resolves.not.toThrow();
    });

    it("should block updating event capacity to > 500 for new tier", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockState.mockPastEventWithCheckIn = false;

      await expect(
        assertCanUpdateEvent(1, { capacity: 800 })
      ).rejects.toThrowError(TRPCError);

      await expect(
        assertCanUpdateEvent(1, { capacity: 800 })
      ).rejects.toThrow(/exceeds allowed limit of 500/);
    });

    it("should allow updating event capacity to > 500 for trusted tier", async () => {
      mockState.mockUser.created_at = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old
      mockState.mockPastEventWithCheckIn = false;

      await expect(
        assertCanUpdateEvent(1, { capacity: 5000 })
      ).resolves.not.toThrow();
    });
  });
});
