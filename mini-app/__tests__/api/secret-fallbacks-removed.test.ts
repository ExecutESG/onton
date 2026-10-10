import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { generatePassToken, verifyPassToken } from "../../src/lib/totp/passToken";
import { verifyBotHmac } from "../../src/server/botHmacAuth";
import { getTelegramBotHeaders } from "../../src/lib/tgBotConfig";

const HMAC_SECRET = "test-bot-hmac-secret-0123456789abcdef";
const ONTON_API_SECRET = "test-onton-api-secret-0123456789abcdef";
const BOT_TOKEN = "123456:test-bot-token-0123456789abcdef";

function signedRequest(secret: string, body: string): Request {
  const ts = Date.now().toString();
  const url = "http://localhost:3000/api/v1/payout";
  const signature = createHmac("sha256", secret).update(`${ts}.POST./api/v1/payout.${body}`).digest("hex");
  return new Request(url, {
    method: "POST",
    headers: { "x-signature": signature, "x-timestamp": ts, "Content-Type": "application/json" },
    body,
  });
}

describe("#1052 secret fallbacks removed", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ONTON_API_SECRET, BOT_TOKEN };
    delete process.env.BOT_API_HMAC_SECRET;
    delete process.env.TOTP_SECRET;
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("passToken (TOTP_SECRET only)", () => {
    it("throws instead of using the hardcoded salt when TOTP_SECRET is unset", () => {
      expect(() => generatePassToken("11111111-1111-1111-1111-111111111111")).toThrow(/TOTP_SECRET is not set/);
    });

    it("ignores JWT_SECRET as a fallback", () => {
      process.env.JWT_SECRET = "legacy-jwt-secret-0123456789abcdef-xyz";
      expect(() => generatePassToken("11111111-1111-1111-1111-111111111111")).toThrow(/TOTP_SECRET/);
    });

    it("a token forged with the old hardcoded salt does not verify", () => {
      process.env.TOTP_SECRET = "test-totp-secret-0123456789abcdef-xyz";
      const forged = generatePassToken("11111111-1111-1111-1111-111111111111", {
        secret: "onton_dynamic_pass_secret_salt_2026",
      });
      expect(verifyPassToken(forged.token).valid).toBe(false);
    });
  });

  describe("verifyBotHmac (BOT_API_HMAC_SECRET only)", () => {
    it("returns 500 when BOT_API_HMAC_SECRET is unset, even with an ONTON_API_SECRET signature", async () => {
      const res = await verifyBotHmac(signedRequest(ONTON_API_SECRET, "{}"));
      expect(res?.status).toBe(500);
    });

    it("rejects requests signed with ONTON_API_SECRET or BOT_TOKEN", async () => {
      process.env.BOT_API_HMAC_SECRET = HMAC_SECRET;
      expect((await verifyBotHmac(signedRequest(ONTON_API_SECRET, "{}")))?.status).toBe(401);
      expect((await verifyBotHmac(signedRequest(BOT_TOKEN, "{}")))?.status).toBe(401);
    });

    it("accepts requests signed with BOT_API_HMAC_SECRET", async () => {
      process.env.BOT_API_HMAC_SECRET = HMAC_SECRET;
      expect(await verifyBotHmac(signedRequest(HMAC_SECRET, "{}"))).toBeNull();
    });
  });

  describe("getTelegramBotHeaders (BOT_API_HMAC_SECRET only)", () => {
    it("throws instead of signing with ONTON_API_SECRET / BOT_TOKEN", () => {
      expect(() => getTelegramBotHeaders({ a: 1 })).toThrow(/BOT_API_HMAC_SECRET is not set/);
    });

    it("signs with BOT_API_HMAC_SECRET", () => {
      process.env.BOT_API_HMAC_SECRET = HMAC_SECRET;
      const headers = getTelegramBotHeaders({ a: 1 });
      const expected = createHmac("sha256", HMAC_SECRET)
        .update(`${headers["x-timestamp"]}.${JSON.stringify({ a: 1 })}`)
        .digest("hex");
      expect(headers["x-signature"]).toBe(expected);
    });
  });
});
