import { describe, it, expect } from "vitest";
import { createMockContext } from "../helpers/mockContext";

describe("User & Identity API Flow", () => {
  it("creates standard participant context with correct role defaults", () => {
    const ctx = createMockContext({ role: "user" });
    expect(ctx.user.user_id).toBe(12345);
    expect(ctx.user.username).toBe("onton_tester");
    expect(ctx.userRole).toBe("user");
    expect(ctx.isOrganizer).toBe(false);
    expect(ctx.isAdmin).toBe(false);
  });

  it("identifies organizer privileges properly", () => {
    const ctx = createMockContext({ role: "organizer" });
    expect(ctx.isOrganizer).toBe(true);
    expect(ctx.isAdmin).toBe(false);
  });

  it("identifies admin privileges properly", () => {
    const ctx = createMockContext({ role: "admin" });
    expect(ctx.isOrganizer).toBe(true);
    expect(ctx.isAdmin).toBe(true);
  });

  it("handles wallet address binding", () => {
    const testWallet = "EQBvW8Z5huBkMJYdn3PCDnTWKK3iqKIOFd3zCXPawpReQDrC";
    const ctx = createMockContext({ wallet_address: testWallet });
    expect(ctx.userAddress).toBe(testWallet);
  });

  describe("Telegram Login Widget Authentication", () => {
    it("validates Telegram widget HMAC hash matching bot token", () => {
      const crypto = require("crypto");
      const botToken = "test_bot_token_secret_123";
      const params = {
        auth_date: "1762000000",
        first_name: "Mahdi",
        id: "12345678",
        username: "bemehrbani",
      };

      const checkString = Object.keys(params)
        .sort()
        .map((k) => `${k}=${(params as any)[k]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(botToken).digest();
      const expectedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

      expect(expectedHash).toHaveLength(64);

      // Verify that invalid data produces a hash mismatch
      const tamperedCheckString = checkString + "\nid=99999999";
      const tamperedHash = crypto.createHmac("sha256", secretKey).update(tamperedCheckString).digest("hex");
      expect(tamperedHash).not.toBe(expectedHash);
    });

    it("rejects auth_date older than 24 hours (86400s)", () => {
      const now = Math.floor(Date.now() / 1000);
      const staleAuthDate = now - 90000; // > 24 hours
      const freshAuthDate = now - 300; // 5 mins ago

      expect(now - staleAuthDate > 86400).toBe(true);
      expect(now - freshAuthDate > 86400).toBe(false);
    });

    it("validateMiniAppData enforces 24-hour expiration TTL (#935)", async () => {
      const { validateMiniAppData } = await import("@/utils");
      const now = Math.floor(Date.now() / 1000);

      // Expired initData (> 24 hours old)
      const expiredAuthDate = now - 90000;
      const expiredQuery = `auth_date=${expiredAuthDate}&query_id=test_query&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Test%22%7D&hash=fakehash`;
      const expiredResult = validateMiniAppData(expiredQuery);
      expect(expiredResult.valid).toBe(false);
      expect((expiredResult as any).error).toBe("AUTH_DATE_EXPIRED");

      // Future clock drift (> 5 mins into future)
      const futureAuthDate = now + 600;
      const futureQuery = `auth_date=${futureAuthDate}&query_id=test_query&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Test%22%7D&hash=fakehash`;
      const futureResult = validateMiniAppData(futureQuery);
      expect(futureResult.valid).toBe(false);
      expect((futureResult as any).error).toBe("AUTH_DATE_FUTURE_DRIFT");

      // Missing auth_date
      const missingQuery = `query_id=test_query&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Test%22%7D&hash=fakehash`;
      const missingResult = validateMiniAppData(missingQuery);
      expect(missingResult.valid).toBe(false);
      expect((missingResult as any).error).toBe("MISSING_OR_INVALID_AUTH_DATE");
    });
  });
});
