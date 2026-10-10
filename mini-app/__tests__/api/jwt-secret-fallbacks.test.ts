import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as jwt from "jsonwebtoken";
import { SignJWT } from "jose";
import {
  createPlatformToken,
  createWebSessionToken,
  getAuthJwtSecret,
  verifyPlatformToken,
  verifyToken,
} from "../../src/server/utils/jwt";
import { getAuthenticatedUser } from "../../src/server/auth";

const TEST_AUTH_JWT_SECRET = "test-auth-jwt-secret-0123456789abcdef";
const TEST_ONTON_API_SECRET = "test-onton-api-secret-0123456789abcdef";
const TEST_BOT_TOKEN = "123456:test-bot-token-0123456789abcdef";
const OLD_HARDCODED_FALLBACK = "onton-platform-default-secret-key-32chars";

function bearer(token: string): Request {
  return new Request("https://app.test/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

async function joseSign(secret: string, alg: "HS256" | "HS512" = "HS256"): Promise<string> {
  return new SignJWT({ userId: 42, role: "admin" })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

describe("#1051 platform JWT accepts AUTH_JWT_SECRET only", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_JWT_SECRET: TEST_AUTH_JWT_SECRET,
      ONTON_API_SECRET: TEST_ONTON_API_SECRET,
      BOT_TOKEN: TEST_BOT_TOKEN,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts a token signed with AUTH_JWT_SECRET (jose and jsonwebtoken paths)", async () => {
    const token = await createPlatformToken({ userId: 42, provider: "email" });
    expect((await verifyPlatformToken(token))?.userId).toBe(42);
    const [userId, err] = getAuthenticatedUser(bearer(token));
    expect(err).toBeNull();
    expect(userId).toBe(42);
  });

  it("maps web session authMethod to a platform provider", async () => {
    const token = await createWebSessionToken({ userId: 7, authMethod: "telegram_widget" });
    expect(await verifyPlatformToken(token)).toMatchObject({ userId: 7, provider: "telegram" });
  });

  const rejectedSecrets: Array<[string, () => string]> = [
    ["ONTON_API_SECRET", () => TEST_ONTON_API_SECRET],
    ["BOT_TOKEN", () => TEST_BOT_TOKEN],
    ["old hardcoded fallback key", () => OLD_HARDCODED_FALLBACK],
  ];

  for (const [label, secret] of rejectedSecrets) {
    it(`rejects a token signed with ${label} (verifyPlatformToken / verifyToken)`, async () => {
      const token = await joseSign(secret());
      expect(await verifyPlatformToken(token)).toBeNull();
      expect(await verifyToken(token)).toBeNull();
    });

    it(`returns 401 for a Bearer token signed with ${label} (getAuthenticatedUser)`, () => {
      const token = jwt.sign({ userId: 42, role: "admin" }, secret());
      const [userId, err] = getAuthenticatedUser(bearer(token));
      expect(userId).toBeNull();
      expect(err?.status).toBe(401);
    });
  }

  it("rejects HS512 even with the correct secret (algorithm pinned to HS256)", async () => {
    const token = await joseSign(TEST_AUTH_JWT_SECRET, "HS512");
    expect(await verifyPlatformToken(token)).toBeNull();
    const legacy = jwt.sign({ userId: 42 }, TEST_AUTH_JWT_SECRET, { algorithm: "HS512" });
    expect(getAuthenticatedUser(bearer(legacy))[0]).toBeNull();
  });

  it("rejects unsigned alg=none tokens", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ userId: 42 })).toString("base64url");
    const token = `${header}.${body}.`;
    expect(await verifyPlatformToken(token)).toBeNull();
    expect(getAuthenticatedUser(bearer(token))[0]).toBeNull();
  });

  it("does not fall back when AUTH_JWT_SECRET is missing", async () => {
    delete process.env.AUTH_JWT_SECRET;
    expect(() => getAuthJwtSecret()).toThrow(/AUTH_JWT_SECRET is not set/);
    await expect(createPlatformToken({ userId: 1, provider: "email" })).rejects.toThrow(/AUTH_JWT_SECRET/);
    const tokenWithApiSecret = await joseSign(TEST_ONTON_API_SECRET);
    expect(await verifyPlatformToken(tokenWithApiSecret)).toBeNull();
    expect(getAuthenticatedUser(bearer(tokenWithApiSecret))[0]).toBeNull();
  });

  it("refuses a short AUTH_JWT_SECRET", () => {
    process.env.AUTH_JWT_SECRET = "short";
    expect(() => getAuthJwtSecret()).toThrow(/AUTH_JWT_SECRET is shorter than 32/);
  });
});
