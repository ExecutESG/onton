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
  },
}));

vi.mock("../../src/lib/redisTools", () => ({
  redisTools: {
    cacheKeys: { userGoogle: "ug", userGoogleByGId: "ugg" },
    deleteCache: vi.fn(),
  },
}));

describe("usersGoogleDB.upsertGoogleAccount", () => {
  it("deletes by both userId and gUserId to prevent constraint violations", async () => {
    await usersGoogleDB.upsertGoogleAccount({
      userId: 123,
      gUserId: "g123",
    });
    
    // We expect db.delete to have been called for both userId and gUserId
    expect(db.delete).toHaveBeenCalledTimes(2);
  });
});
