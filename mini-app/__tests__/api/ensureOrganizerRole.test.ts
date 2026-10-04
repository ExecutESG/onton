import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => ({
  currentUser: null as Record<string, unknown> | null,
  identities: [] as Record<string, unknown>[],
  updateCalls: [] as Record<string, unknown>[],
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
    getCache: vi.fn().mockImplementation(async () => mockState.currentUser),
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
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => ({
            execute: vi.fn().mockImplementation(async () => {
              return mockState.currentUser ? [mockState.currentUser] : [];
            }),
          })),
          execute: vi.fn().mockImplementation(async () => {
            return mockState.currentUser ? [mockState.currentUser] : [];
          }),
        })),
      }),
    })),

    
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((setData: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(() => ({
          execute: vi.fn().mockImplementation(async () => {
            mockState.updateCalls.push(setData);
            if (mockState.currentUser && setData.role) {
              mockState.currentUser.role = setData.role;
            }
            return [];
          }),
        })),
      })),
    })),
    query: {
      user_identities: {
        findFirst: vi.fn().mockImplementation(async () => {
          return (
            mockState.identities.find(
              (id) =>
                ALLOWED_ORGANIZER_PROVIDERS.includes(id.provider as string) &&
                id.verified === true
            ) || null
          );
        }),
      },
    },
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { ensureOrganizerRole, ALLOWED_ORGANIZER_PROVIDERS } from "@/db/modules/users.db";

describe("ensureOrganizerRole (Issue #1031)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.currentUser = null;
    mockState.identities.length = 0;
    mockState.updateCalls.length = 0;
  });

  it("should preserve role when user is already an organizer", async () => {
    mockState.currentUser = {
      user_id: 101,
      role: "organizer",
    };

    const res = await ensureOrganizerRole(101);
    expect(res).toBe(true);
    expect(mockState.updateCalls.length).toBe(0);
  });

  it("should preserve role when user is an admin", async () => {
    mockState.currentUser = {
      user_id: 102,
      role: "admin",
    };

    const res = await ensureOrganizerRole(102);
    expect(res).toBe(true);
    expect(mockState.updateCalls.length).toBe(0);
  });

  it("should upgrade user with verified email to organizer", async () => {
    mockState.currentUser = {
      user_id: 103,
      role: "user",
    };
    mockState.identities.push({
      user_id: 103,
      provider: "email",
      provider_user_id: "organizer@example.com",
      verified: true,
    });

    const res = await ensureOrganizerRole(103);
    expect(res).toBe(true);
    expect(mockState.updateCalls.length).toBe(1);
    expect(mockState.updateCalls[0].role).toBe("organizer");
    expect(mockState.currentUser.role).toBe("organizer");
  });

  it("should upgrade user with verified Telegram identity to organizer", async () => {
    mockState.currentUser = {
      user_id: 104,
      role: "user",
    };
    mockState.identities.push({
      user_id: 104,
      provider: "telegram",
      provider_user_id: "987654321",
      verified: true,
    });

    const res = await ensureOrganizerRole(104);
    expect(res).toBe(true);
    expect(mockState.updateCalls.length).toBe(1);
    expect(mockState.updateCalls[0].role).toBe("organizer");
    expect(mockState.currentUser.role).toBe("organizer");
  });

  it("should upgrade user with verified Google identity to organizer", async () => {
    mockState.currentUser = {
      user_id: 105,
      role: "user",
    };
    mockState.identities.push({
      user_id: 105,
      provider: "google",
      provider_user_id: "google-sub-123",
      verified: true,
    });

    const res = await ensureOrganizerRole(105);
    expect(res).toBe(true);
    expect(mockState.updateCalls.length).toBe(1);
    expect(mockState.updateCalls[0].role).toBe("organizer");
    expect(mockState.currentUser.role).toBe("organizer");
  });

  it("should block a user with only a ton_wallet identity", async () => {
    mockState.currentUser = {
      user_id: 106,
      role: "user",
    };
    mockState.identities.push({
      user_id: 106,
      provider: "ton_wallet",
      provider_user_id: "EQD...wallet",
      verified: true,
    });

    const res = await ensureOrganizerRole(106);
    expect(res).toBe(false);
    expect(mockState.updateCalls.length).toBe(0);
    expect(mockState.currentUser.role).toBe("user");
  });

  it("should block a user whose email is unverified", async () => {
    mockState.currentUser = {
      user_id: 107,
      role: "user",
    };
    mockState.identities.push({
      user_id: 107,
      provider: "email",
      provider_user_id: "unverified@example.com",
      verified: false,
    });

    const res = await ensureOrganizerRole(107);
    expect(res).toBe(false);
    expect(mockState.updateCalls.length).toBe(0);
    expect(mockState.currentUser.role).toBe("user");
  });

  it("should upgrade user with an existing telegram identity and verify correct upsert target", async () => {
    const { db } = await import("@/db/db");
    const { user_identities } = await import("@/db/schema/userIdentities");
    
    mockState.currentUser = {
      user_id: 108,
      role: "user",
      telegram_id: "108_tg",
    };
    mockState.identities.push({
      user_id: 108,
      provider: "telegram",
      provider_user_id: "108_tg",
      verified: true,
    });

    const res = await ensureOrganizerRole(108);
    expect(res).toBe(true);
    
    // verify the upsert target matches the unique index [provider, provider_user_id]
    const onConflictMock = (db.insert as any)().values().onConflictDoUpdate;
    expect(onConflictMock).toHaveBeenCalled();
    const callArgs = onConflictMock.mock.calls[0][0];
    
    expect(callArgs.target).toEqual([user_identities.provider, user_identities.provider_user_id]);
  });

  it("should return false for non-existent user", async () => {
    mockState.currentUser = null;
    const res = await ensureOrganizerRole(999);
    expect(res).toBe(false);
  });
});
