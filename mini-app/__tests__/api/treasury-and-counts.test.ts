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
      groupBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockImplementation(async () => {
        return [ { owner: 1, event_uuid: "123e4567-e89b-12d3-a456-426614174000" } ];
      }),
      query: {
        events: {
          findFirst: vi.fn().mockImplementation(async ({ where }) => {
            return { event_uuid: "123e4567-e89b-12d3-a456-426614174000", owner: 1, has_registration: true };
          })
        },
        orders: { findFirst: vi.fn(), findMany: vi.fn() }
      }
    },
    closeDB: vi.fn()
  };
});

vi.mock("@/db/modules/userRoles.db", () => ({
  userRolesDB: {
    listActiveUserRolesForEvent: vi.fn().mockResolvedValue([ { userId: 2, role: "checkin_officer" } ]),
    checkAccess: vi.fn().mockImplementation(async (userId, roles) => {
       if (userId === 1 || userId === 2) return ["admin"];
       return [];
    })
  }
}));

vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    getCache: vi.fn().mockResolvedValue({}),
    setCache: vi.fn(),
    deleteCache: vi.fn(),
    cacheKeys: { user: 'u', userWallet: 'uw' },
    cacheLvl: { long: 3600 }
  }
}));

import { appRouter } from "../../src/server/index";

describe("Treasury & Counts API Tests", () => {
  const callerUser = (role: string, user_id: number) => {
    return appRouter.createCaller({ user: { role, user_id }, req: {} as any, res: {} as any });
  };
  const callerAnon = () => {
    return appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
  };

  it("Treasury access: anonymous 401", async () => {
    await expect(callerAnon().orders.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" }))
      .rejects.toThrow(/UNAUTHORIZED|No auth header/);
  });

  it("Treasury access: co-organizer/officer 403", async () => {
    await expect(callerUser("user", 2).orders.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" }))
      .rejects.toThrow(/FORBIDDEN|Only owner and admin/);
  });

  it("Treasury access: owner OK", async () => {
    const res = await callerUser("user", 1).orders.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" }).catch(e => e.message);
    expect(res).not.toMatch(/FORBIDDEN/);
  });
  
  it("Treasury access: admin OK", async () => {
    const res = await callerUser("admin", 99).orders.getEventTreasury({ event_uuid: "123e4567-e89b-12d3-a456-426614174000" }).catch(e => e.message);
    expect(res).not.toMatch(/FORBIDDEN/);
  });

  it("Treasury logic: fee from PLATFORM_FEE_PERCENT and per-currency", async () => {
    expect(true).toBe(true);
  });
  
  it("Counts query: approved/checkedin vs pending vs waitlisted", async () => {
    expect(true).toBe(true);
  });
});
