import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisStore = new Map<string, any>();
const redisTtls = new Map<string, number>();

vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    getCache: vi.fn(async (key: string) => redisStore.get(key)),
    setCache: vi.fn(async (key: string, value: any, ttl?: number) => {
      redisStore.set(key, value);
      if (ttl) redisTtls.set(key, ttl);
    }),
    deleteCache: vi.fn(async (key: string) => {
      redisStore.delete(key);
      redisTtls.delete(key);
    }),
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

import { authEngine } from "@/lib/auth/authEngine";
import { logger } from "@/server/utils/logger";
import { POST as sendOtpRoute } from "@/app/api/v1/auth/email/send-otp/route";
import { POST as verifyOtpRoute } from "@/app/api/v1/auth/email/verify-otp/route";
import { NextRequest } from "next/server";

describe("Issue #1054: Email OTP Security Hardening", () => {
  const originalEnv = process.env;
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    process.env = { ...originalEnv };
    redisStore.clear();
    redisTtls.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. OTP Code Logging Elimination", () => {
    it("never logs the OTP code in logger.info or console.log", async () => {
      const email = "alice@example.com";
      const result = await authEngine.generateEmailOtp(email);
      expect(result.success).toBe(true);

      const cachedCode = redisStore.get(`otp:code:${email}`);
      expect(cachedCode).toBeDefined();
      expect(typeof cachedCode).toBe("string");
      expect(cachedCode).toHaveLength(6);

      // Check logger.info
      for (const call of (logger.info as any).mock.calls) {
        const msg = call.join(" ");
        expect(msg).not.toContain(cachedCode);
        expect(msg).toContain(`[AUTH] OTP issued for ${email}`);
      }

      // Check console.log
      for (const call of consoleLogSpy.mock.calls) {
        const msg = call.join(" ");
        expect(msg).not.toContain(cachedCode);
      }
    });
  });

  describe("2. Verify Attempt Counter & 15-Minute Lockout", () => {
    const email = "bob@example.com";

    it("locks the account and deletes the code after 5 consecutive failed attempts", async () => {
      await authEngine.generateEmailOtp(email);
      const code = redisStore.get(`otp:code:${email}`);
      expect(code).toBeDefined();

      // Attempts 1 to 4 fail
      for (let i = 1; i <= 4; i++) {
        const res = await authEngine.verifyEmailOtp(email, "000000");
        expect(res.valid).toBe(false);
        expect(res.locked).toBeFalsy();
        expect(redisStore.get(`otp:fail:${email}`)).toBe(String(i));
        // Code still exists
        expect(redisStore.get(`otp:code:${email}`)).toBe(code);
      }

      // 5th failed attempt triggers lockout
      const fifthRes = await authEngine.verifyEmailOtp(email, "000000");
      expect(fifthRes.valid).toBe(false);
      expect(fifthRes.locked).toBe(true);

      // Code must be deleted from Redis
      expect(redisStore.get(`otp:code:${email}`)).toBeUndefined();
      // Lock key set in Redis with 900s (15 min) TTL
      expect(redisStore.get(`otp:lock:${email}`)).toBe("1");
      expect(redisTtls.get(`otp:lock:${email}`)).toBe(900);

      // 6th attempt gets locked response
      const sixthRes = await authEngine.verifyEmailOtp(email, "000000");
      expect(sixthRes.valid).toBe(false);
      expect(sixthRes.locked).toBe(true);

      // Generating new OTP during lockout is blocked
      const sendRes = await authEngine.generateEmailOtp(email);
      expect(sendRes.success).toBe(false);
      expect(sendRes.locked).toBe(true);
      expect(sendRes.message).toContain("locked");
    });

    it("clears the failure counter on successful verification", async () => {
      await authEngine.generateEmailOtp(email);
      const validCode = redisStore.get(`otp:code:${email}`);

      // 2 failed attempts
      await authEngine.verifyEmailOtp(email, "999999");
      await authEngine.verifyEmailOtp(email, "888888");
      expect(redisStore.get(`otp:fail:${email}`)).toBe("2");

      // Successful attempt
      const successRes = await authEngine.verifyEmailOtp(email, validCode);
      expect(successRes.valid).toBe(true);
      expect(redisStore.get(`otp:code:${email}`)).toBeUndefined();
      expect(redisStore.get(`otp:fail:${email}`)).toBeUndefined();
    });
  });

  describe("3. Feature Flag Enforcement on API Routes", () => {
    it("returns 404 when AUTH_EMAIL_OTP_ENABLED is not set", async () => {
      delete process.env.AUTH_EMAIL_OTP_ENABLED;
      delete process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED;

      const sendReq = new NextRequest("http://localhost/api/v1/auth/email/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      });
      const sendRes = await sendOtpRoute(sendReq);
      expect(sendRes.status).toBe(404);

      const verifyReq = new NextRequest("http://localhost/api/v1/auth/email/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com", code: "123456" }),
      });
      const verifyRes = await verifyOtpRoute(verifyReq);
      expect(verifyRes.status).toBe(404);
    });

    it("returns 429 on verify-otp route when account is locked out", async () => {
      process.env.AUTH_EMAIL_OTP_ENABLED = "true";

      const email = "locked@example.com";
      redisStore.set(`otp:lock:${email}`, "1");

      const verifyReq = new NextRequest("http://localhost/api/v1/auth/email/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code: "123456" }),
      });
      const verifyRes = await verifyOtpRoute(verifyReq);
      expect(verifyRes.status).toBe(429);
      const json = await verifyRes.json();
      expect(json.error).toContain("locked");
    });
  });
});
