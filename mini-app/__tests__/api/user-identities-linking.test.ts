import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUsersTable, mockIdentitiesTable } = vi.hoisted(() => ({
  mockUsersTable: {} as Record<number, any>,
  mockIdentitiesTable: [] as any[],
}));

vi.mock("@/db/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    query: {
      users: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          return Object.values(mockUsersTable)[0] || null;
        }),
      },
      user_identities: {
        findFirst: vi.fn().mockImplementation(() => {
          return mockIdentitiesTable[0] || null;
        }),
        findMany: vi.fn().mockImplementation(() => {
          return mockIdentitiesTable;
        }),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => [mockIdentitiesTable[0]]),
        }),
        returning: vi.fn().mockImplementation(() => [mockIdentitiesTable[0]]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockIdentitiesTable[0]]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { userIdentitiesDB } from "@/db/modules/userIdentities.db";

describe("Multi-Provider User Identities & Linking Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdentitiesTable.length = 0;
  });

  it("prevents unlinking when user has only one linked identity (lockout protection)", async () => {
    // Single identity in list
    mockIdentitiesTable.push({
      id: "id-1",
      user_id: 1001,
      provider: "telegram",
      provider_user_id: "12345",
      verified: true,
    });

    const result = await userIdentitiesDB.unlinkIdentity(1001, "telegram");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot unlink the only authentication method");
  });

  it("detects conflict when external account is already bound to another user", async () => {
    // Existing identity belongs to user 9999
    mockIdentitiesTable.push({
      id: "id-2",
      user_id: 9999,
      provider: "google",
      provider_user_id: "google-sub-456",
      verified: true,
    });

    // User 1001 tries to link the same Google sub
    const result = await userIdentitiesDB.linkIdentity(1001, "google", "google-sub-456");
    expect(result.success).toBe(false);
    expect(result.error).toContain("already linked to a different ONTON profile");
  });

  it("allows updating metadata when linking the same provider to the same user", async () => {
    // Identity belongs to user 1001
    mockIdentitiesTable.push({
      id: "id-3",
      user_id: 1001,
      provider: "ton_wallet",
      provider_user_id: "0:4e220025...",
      provider_metadata: { address: "0:4e220025..." },
      verified: true,
    });

    const result = await userIdentitiesDB.linkIdentity(1001, "ton_wallet", "0:4e220025...", {
      address: "0:4e220025...",
      network: "-239",
    });

    expect(result.success).toBe(true);
  });
});
