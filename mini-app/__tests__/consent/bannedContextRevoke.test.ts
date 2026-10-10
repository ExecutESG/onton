import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("@/db/db", () => ({
  db: {
    query: {
      user_consents: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              user_id: 9999,
              purpose: "audience_reach",
              policy_version: "2024-09-11",
              granted_at: new Date(),
              revoked_at: new Date(),
            },
          ]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  closeDB: vi.fn(),
}));

const mockBannedUser = {
  user_id: 9999,
  role: "ban",
  username: "banned_user",
  first_name: "Banned",
};

vi.mock("@/db/modules/users.db", () => ({
  selectUserById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 9999) return mockBannedUser;
    return null;
  }),
  usersDB: {
    insertUser: vi.fn(),
    selectUserById: vi.fn(),
  },
}));

vi.mock("@/server/utils/jwt", () => ({
  verifyPlatformToken: vi.fn().mockImplementation(async (token: string) => {
    if (token === "banned-user-jwt") {
      return { userId: 9999, role: "ban" };
    }
    return null;
  }),
}));

import { createContext } from "@/server/context";
import { consentsRouter } from "@/server/routers/consents";

describe("Banned User End-to-End Auth Context & GDPR Consent Revocation (#1038)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createContext allows banned user to attach to context without throwing FORBIDDEN early", async () => {
    const req = new Request("http://localhost/api/trpc/consents.revoke", {
      headers: {
        Authorization: "Bearer banned-user-jwt",
      },
    });

    const ctx = await createContext({ req });
    expect(ctx.user).toBeDefined();
    expect(ctx.user?.user_id).toBe(9999);
    expect(ctx.user?.role).toBe("ban");
  });

  it("allows banned user context to revoke consent (GDPR Article 7(3))", async () => {
    const req = new Request("http://localhost/api/trpc/consents.revoke", {
      headers: {
        Authorization: "Bearer banned-user-jwt",
      },
    });

    const ctx = await createContext({ req });
    const caller = consentsRouter.createCaller(ctx);

    const res = await caller.revoke({ purpose: "audience_reach" });
    expect(res.success).toBe(true);
    expect(res.revoked).toBe("audience_reach");
    expect(res.records).toHaveLength(1);
  });

  it("enforces FORBIDDEN on getMine and grant for banned user context", async () => {
    const req = new Request("http://localhost/api/trpc/consents.getMine", {
      headers: {
        Authorization: "Bearer banned-user-jwt",
      },
    });

    const ctx = await createContext({ req });
    const caller = consentsRouter.createCaller(ctx);

    await expect(caller.getMine()).rejects.toThrowError(
      new TRPCError({ code: "FORBIDDEN", message: "user is banned" })
    );

    await expect(caller.grant({ purposes: ["audience_reach"] })).rejects.toThrowError(
      new TRPCError({ code: "FORBIDDEN", message: "user is banned" })
    );
  });

  it("enforces UNAUTHORIZED on revoke when auth header is missing", async () => {
    const req = new Request("http://localhost/api/trpc/consents.revoke");

    const ctx = await createContext({ req });
    expect(ctx.user).toBeNull();

    const caller = consentsRouter.createCaller(ctx);
    await expect(caller.revoke({ purpose: "audience_reach" })).rejects.toThrowError(
      new TRPCError({ code: "UNAUTHORIZED", message: "No auth header found" })
    );
  });
});
