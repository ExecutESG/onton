import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOriginAllowed, getCorsHeaders, getAllowedOrigins } from "../../src/lib/cors";
import crypto from "crypto";

describe("CORS Allowlist (Issue #943)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should allow production onton.live domains by default", () => {
    expect(isOriginAllowed("https://app.onton.live")).toBe(true);
    expect(isOriginAllowed("https://app.dev.onton.live")).toBe(true);
    expect(isOriginAllowed("https://onton.live")).toBe(true);
  });

  it("should reject untrusted third-party origins", () => {
    expect(isOriginAllowed("https://evil-site.com")).toBe(false);
    expect(isOriginAllowed("https://attacker.org")).toBe(false);
    expect(isOriginAllowed("null")).toBe(false);
    expect(isOriginAllowed("")).toBe(false);
    expect(isOriginAllowed(null)).toBe(false);
  });

  it("should support additional custom origins from CORS_ALLOWED_ORIGINS env", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://custom.onton.io, https://partner.app";
    expect(isOriginAllowed("https://custom.onton.io")).toBe(true);
    expect(isOriginAllowed("https://partner.app")).toBe(true);
  });

  it("should return Access-Control-Allow-Origin only for allowed origins", () => {
    const validHeaders = getCorsHeaders("https://app.onton.live");
    expect(validHeaders["Access-Control-Allow-Origin"]).toBe("https://app.onton.live");
    expect(validHeaders["Access-Control-Allow-Credentials"]).toBe("true");

    const invalidHeaders = getCorsHeaders("https://evil-site.com");
    expect(invalidHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("HMAC Signature Generation & Verification (Issue #940)", () => {
  const secret = "test-secret-key-12345";

  it("should create valid HMAC signature that matches expected hex", () => {
    const timestamp = Date.now().toString();
    const body = { user_id: 12345 };
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    expect(signature).toHaveLength(64);

    const verifyHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    expect(crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(verifyHmac))).toBe(true);
  });

  it("should fail verification when payload is altered", () => {
    const timestamp = Date.now().toString();
    const payload = `${timestamp}.{"user_id":12345}`;
    const tamperedPayload = `${timestamp}.{"user_id":99999}`;

    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const tamperedSig = crypto.createHmac("sha256", secret).update(tamperedPayload).digest("hex");

    expect(signature).not.toBe(tamperedSig);
  });
});
