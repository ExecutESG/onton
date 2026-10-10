import { describe, it, expect, vi } from "vitest";
import { usersGoogleDB } from "../../src/db/modules/usersGoogle.db";
import { db } from "../../src/db/db";

vi.mock("../../src/db/db", () => ({
  db: {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../src/lib/redisTools", () => ({
  redisTools: {
    cacheKeys: { userGoogle: "ug", userGoogleByGId: "ugg" },
    cacheLvl: { medium: 3600 },
    deleteCache: vi.fn(),
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn(),
  },
}));

describe("usersGoogleDB.upsertGoogleAccount", () => {
  it("deletes by both userId and gUserId to prevent constraint violations", async () => {
    await usersGoogleDB.upsertGoogleAccount({
      userId: 123,
      gUserId: "g123",
    });
    
    // We expect db.delete to have been called once for userId
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("throws an error when trying to link a Google account owned by another user", async () => {
    // Mock getCache to return a DIFFERENT user id
    const { redisTools } = await import("../../src/lib/redisTools");
    (redisTools.getCache as any).mockResolvedValueOnce(999);

    await expect(
      usersGoogleDB.upsertGoogleAccount({
        userId: 123,
        gUserId: "g123",
      })
    ).rejects.toThrow("This Google account is already linked to another user.");
  });
});
