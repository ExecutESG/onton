import { describe, it, expect, vi } from "vitest";

vi.mock("@/db/db", () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([ { owner: 1, event_uuid: "123e4567-e89b-12d3-a456-426614174000" } ]),
      query: {
        events: {
          findFirst: vi.fn().mockResolvedValue({ event_uuid: "123e4567-e89b-12d3-a456-426614174000", owner: 1 })
        }
      }
    },
    closeDB: vi.fn()
  };
});

vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn(),
    deleteCache: vi.fn(),
    cacheKeys: { user: 'user' },
    cacheLvl: { long: 3600 }
  }
}));

vi.mock("@/db/modules/userRoles.db", () => ({
  userRolesDB: {
    listActiveUserRolesForEvent: vi.fn().mockResolvedValue([ { userId: 2, role: "checkin_officer" } ]),
    // checkAccess needs to return a truthy array to pass the middleware
    checkAccess: vi.fn().mockResolvedValue(["admin", "checkin_officer"])
  }
}));

import { ordersRouter } from "../../src/server/routers/orders";

describe("Treasury access control via TRPC caller", () => {
  it("should deny co-organizers from accessing treasury", async () => {
    const caller = ordersRouter.createCaller({ user: { role: "user", user_id: 2 } } as any);
    await expect(caller.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" }))
      .rejects.toThrow(/Only owner and admin can access treasury/);
  });
  
  it("should allow owners to access treasury", async () => {
    const caller = ordersRouter.createCaller({ user: { role: "user", user_id: 1 } } as any);
    const result = await caller.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" });
    expect(result).toHaveProperty("payout_status");
  });
});
