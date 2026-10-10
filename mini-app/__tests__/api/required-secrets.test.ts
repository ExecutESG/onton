import { describe, it, expect } from "vitest";
import {
  assertRequiredSecrets,
  MissingSecretError,
  readRequiredSecret,
  REQUIRED_SECRET_KEYS,
  KNOWN_DEFAULT_SECRET_SHA256,
} from "../../src/server/utils/requiredSecrets";
import { createHash } from "crypto";

const VALID_ENV: Record<string, string | undefined> = {
  NODE_ENV: "test",
  AUTH_JWT_SECRET: "a".repeat(16) + "0123456789abcdef",
  TOTP_SECRET: "b".repeat(16) + "0123456789abcdef",
  ONTON_API_SECRET: "c".repeat(16) + "0123456789abcdef",
  BOT_API_HMAC_SECRET: "d".repeat(16) + "0123456789abcdef",
  BOT_TOKEN: "123456:bot-token-value",
};

function captureError(fn: () => void): MissingSecretError {
  try {
    fn();
  } catch (err) {
    if (err instanceof MissingSecretError) return err;
    throw err;
  }
  throw new Error("expected MissingSecretError");
}

describe("#1052 assertRequiredSecrets", () => {
  it("passes when all four secrets are set, long and distinct", () => {
    expect(() => assertRequiredSecrets(VALID_ENV)).not.toThrow();
  });

  for (const key of REQUIRED_SECRET_KEYS) {
    it(`throws naming ${key} when it is missing`, () => {
      const env = { ...VALID_ENV };
      delete env[key];
      const err = captureError(() => assertRequiredSecrets(env));
      expect(err.message).toContain(`${key} is not set`);
    });

    it(`throws naming ${key} when shorter than 32 chars, without printing the value`, () => {
      const shortValue = "zz-short-secret-value";
      const err = captureError(() => assertRequiredSecrets({ ...VALID_ENV, [key]: shortValue }));
      expect(err.message).toContain(`${key} is shorter than 32`);
      expect(err.message).not.toContain(shortValue);
    });
  }

  it("rejects .env.example placeholders and old hardcoded fallbacks", () => {
    const knownDefaults = [
      "your_onton_api_secret_here",
      "your_bot_api_hmac_secret_here",
      "onton-platform-default-secret-key-32chars",
      "onton_dynamic_pass_secret_salt_2026",
      "fallback-secret",
    ];
    for (const value of knownDefaults) {
      const err = captureError(() => assertRequiredSecrets({ ...VALID_ENV, TOTP_SECRET: value }));
      expect(err.message).toContain("TOTP_SECRET");
      expect(err.message).not.toContain(value);
    }
    const exact = captureError(() =>
      assertRequiredSecrets({ ...VALID_ENV, AUTH_JWT_SECRET: "onton-platform-default-secret-key-32chars" })
    );
    expect(exact.message).toContain("AUTH_JWT_SECRET equals a known default/example value");

    const paddedPlaceholder = captureError(() =>
      assertRequiredSecrets({ ...VALID_ENV, BOT_API_HMAC_SECRET: "your_bot_api_hmac_secret_padded_to_be_long_here" })
    );
    expect(paddedPlaceholder.message).toContain("BOT_API_HMAC_SECRET equals a known default/example value");
  });

  it("rejects secrets matching blocked SHA-256 hashes without revealing secret value", () => {
    expect(KNOWN_DEFAULT_SECRET_SHA256.size).toBeGreaterThan(5);

    // Mock secret and mock hash in test scope only (#1052)
    const mockSecret = "mock_leaked_secret_never_reveal_32chars!";
    const mockHash = createHash("sha256").update(mockSecret).digest("hex");

    (KNOWN_DEFAULT_SECRET_SHA256 as Set<string>).add(mockHash);
    try {
      const err = captureError(() =>
        assertRequiredSecrets({ ...VALID_ENV, ONTON_API_SECRET: mockSecret })
      );
      expect(err.message).toContain("ONTON_API_SECRET equals a known default/example value");
      expect(err.message).not.toContain(mockSecret);
    } finally {
      (KNOWN_DEFAULT_SECRET_SHA256 as Set<string>).delete(mockHash);
    }
  });

  it("rejects one value reused across keys and reuse of BOT_TOKEN", () => {
    const reused = captureError(() =>
      assertRequiredSecrets({ ...VALID_ENV, BOT_API_HMAC_SECRET: VALID_ENV.ONTON_API_SECRET })
    );
    expect(reused.message).toContain("BOT_API_HMAC_SECRET reuses the value of ONTON_API_SECRET");

    const botToken = "123456:" + "e".repeat(40);
    const sameAsBot = captureError(() => assertRequiredSecrets({ ...VALID_ENV, BOT_TOKEN: botToken, TOTP_SECRET: botToken }));
    expect(sameAsBot.message).toContain("TOTP_SECRET reuses the value of BOT_TOKEN");
  });

  it("readRequiredSecret returns the value or throws naming only the key", () => {
    expect(readRequiredSecret("TOTP_SECRET", VALID_ENV)).toBe(VALID_ENV.TOTP_SECRET);
    expect(() => readRequiredSecret("TOTP_SECRET", {})).toThrow(/TOTP_SECRET is not set/);
  });
});
