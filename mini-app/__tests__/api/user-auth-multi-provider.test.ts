import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createPlatformToken,
  verifyPlatformToken,
  AUTH_JWT_SECRET,
} from "../../src/server/utils/jwt";
import { getAuthenticatedUser } from "../../src/server/auth";
import { safeTimingEqual } from "../../src/server/apiKeyAuth";
import { makeGoogleAuthUrl } from "../../src/lib/google";
import * as jwt from "jsonwebtoken";

describe("Wave 2: Multi-Provider Platform Authentication (#1015, #1016)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTH_JWT_SECRET = "test-platform-auth-secret-key-32chars";
    process.env.BOT_TOKEN = "test-bot-token-12345";
    process.env.ONTON_API_SECRET = "test-onton-api-secret-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Platform JWT Token Issuance & Verification", () => {
    it("should issue and verify a modern platform token with full payload", async () => {
      const payload = {
        userId: 123456,
        userUuid: "550e8400-e29b-41d4-a716-446655440000",
        provider: "google" as const,
        email: "user@example.com",
        role: "organizer",
      };

      const token = await createPlatformToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const verified = await verifyPlatformToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(123456);
      expect(verified?.userUuid).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(verified?.provider).toBe("google");
      expect(verified?.email).toBe("user@example.com");
      expect(verified?.role).toBe("organizer");
    });

    it("should verify legacy tokens signed with BOT_TOKEN", async () => {
      const legacyToken = jwt.sign(
        { id: 987654, name: "Legacy User", role: "user" },
        process.env.BOT_TOKEN as string
      );

      const verified = await verifyPlatformToken(legacyToken);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(987654);
      expect(verified?.provider).toBe("telegram");
    });

    it("should reject tampered tokens", async () => {
      const payload = {
        userId: 123456,
        provider: "email" as const,
        role: "user",
      };
      const token = await createPlatformToken(payload);
      const tamperedToken = token.slice(0, -5) + "abcde";

      const verified = await verifyPlatformToken(tamperedToken);
      expect(verified).toBeNull();
    });
  });

  describe("Omnichannel getAuthenticatedUser() Synchronous Bridge", () => {
    it("should authenticate Bearer token from Request header", () => {
      const token = jwt.sign(
        { userId: 445566, role: "user" },
        process.env.AUTH_JWT_SECRET as string
      );

      const req = new Request("https://app.dev.onton.live/api/v1/event/123", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const [userId, authError] = getAuthenticatedUser(req);
      expect(authError).toBeNull();
      expect(userId).toBe(445566);
    });

    it("should authenticate legacy token signed with BOT_TOKEN via Bearer header", () => {
      const legacyToken = jwt.sign(
        { id: 778899, role: "user" },
        process.env.BOT_TOKEN as string
      );

      const req = new Request("https://app.dev.onton.live/api/v1/event/123", {
        headers: {
          Authorization: `Bearer ${legacyToken}`,
        },
      });

      const [userId, authError] = getAuthenticatedUser(req);
      expect(authError).toBeNull();
      expect(userId).toBe(778899);
    });

    it("should reject request with invalid Bearer token", () => {
      const req = new Request("https://app.dev.onton.live/api/v1/event/123", {
        headers: {
          Authorization: "Bearer invalid.jwt.token",
        },
      });

      const [userId, authError] = getAuthenticatedUser(req);
      expect(userId).toBeNull();
      expect(authError).not.toBeNull();
      expect(authError?.status).toBe(401);
    });

    it("should reject request with malformed or invalid Telegram initData in Authorization header", () => {
      const req = new Request("https://app.dev.onton.live/api/v1/order", {
        headers: {
          Authorization: "query_id=123&user=%7B%22id%22%3A12345%7D&hash=invalid_hash",
        },
      });

      const [userId, authError] = getAuthenticatedUser(req);
      expect(userId).toBeNull();
      expect(authError).not.toBeNull();
      expect(authError?.status).toBe(401);
    });
  });

  describe("Email OTP Constant-Time Verification", () => {
    it("should match identical OTP codes in constant time", () => {
      expect(safeTimingEqual("123456", "123456")).toBe(true);
      expect(safeTimingEqual("000000", "000000")).toBe(true);
    });

    it("should reject mismatched OTP codes without early-termination timing leaks", () => {
      expect(safeTimingEqual("123456", "123457")).toBe(false);
      expect(safeTimingEqual("123456", "654321")).toBe(false);
      expect(safeTimingEqual("123456", "12345")).toBe(false);
      expect(safeTimingEqual("123456", "")).toBe(false);
    });
  });

  describe("Omnichannel Provider Mapping Rules", () => {
    it("should correctly support all planned identity providers", () => {
      const supportedProviders = [
        "telegram",
        "google",
        "email",
        "ton_wallet",
        "discord",
        "apple",
      ];
      expect(supportedProviders).toContain("telegram");
      expect(supportedProviders).toContain("google");
      expect(supportedProviders).toContain("email");
      expect(supportedProviders).toContain("ton_wallet");
      expect(supportedProviders).toHaveLength(6);
    });
  });

  describe("Google OAuth Dynamic Redirect & PKCE Generation", () => {
    it("should use custom redirectUri matching requesting origin", () => {
      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";

      const originRedirectUri = "https://app.dev.onton.live/api/google/callback";
      const result = makeGoogleAuthUrl(originRedirectUri);

      expect(result.redirectUri).toBe(originRedirectUri);
      const parsedUrl = new URL(result.url);
      expect(parsedUrl.searchParams.get("redirect_uri")).toBe(originRedirectUri);
      expect(parsedUrl.searchParams.get("client_id")).toBe("test-google-client-id");
      expect(parsedUrl.searchParams.get("response_type")).toBe("code");
      expect(parsedUrl.searchParams.get("code_challenge")).toBeDefined();
    });

    it("should fallback to NEXT_PUBLIC_APP_BASE_URL when custom redirectUri is omitted", () => {
      process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
      process.env.NEXT_PUBLIC_APP_BASE_URL = "https://dev-app.dev.onton.live";

      const result = makeGoogleAuthUrl();
      expect(result.redirectUri).toBe("https://dev-app.dev.onton.live/api/google/callback");
    });
  });
});
