import {
  generatePassToken,
  verifyPassToken,
  isDynamicToken,
  DEFAULT_STEP_SECONDS,
} from "../src/lib/totp/passToken";

describe("Dynamic Rotating TOTP QR Pass Utility", () => {
  const testUuid = "123e4567-e89b-12d3-a456-426614174000";
  const testSecret = "test_secret_for_totp_suite_12345";

  it("should generate a properly formatted dynamic pass token", () => {
    const fixedTime = 1700000000000; // ms
    const res = generatePassToken(testUuid, { timestamp: fixedTime, stepSeconds: 20, secret: testSecret });

    expect(res.token).toMatch(/^ONTON:v1:123e4567-e89b-12d3-a456-426614174000:\d+:[0-9a-f]{16}$/);
    expect(res.uuid).toBe(testUuid);
    expect(res.stepSeconds).toBe(20);
    expect(res.remainingSeconds).toBeGreaterThanOrEqual(0);
    expect(res.remainingSeconds).toBeLessThanOrEqual(20);
  });

  it("should recognize dynamic tokens vs legacy plain UUIDs", () => {
    expect(isDynamicToken(`ONTON:v1:${testUuid}:123:abcdef0123456789`)).toBe(true);
    expect(isDynamicToken(testUuid)).toBe(false);
    expect(isDynamicToken("random-string")).toBe(false);
  });

  it("should verify a fresh dynamic token successfully", () => {
    const now = Date.now();
    const { token } = generatePassToken(testUuid, { timestamp: now, secret: testSecret });

    const verification = verifyPassToken(token, { currentTimestamp: now, secret: testSecret });
    expect(verification.valid).toBe(true);
    expect(verification.uuid).toBe(testUuid);
    expect(verification.isDynamic).toBe(true);
    expect(verification.error).toBeUndefined();
  });

  it("should verify dynamic token within tolerance window (e.g. 15s later)", () => {
    const baseTime = 1700000000000;
    const { token } = generatePassToken(testUuid, { timestamp: baseTime, stepSeconds: 20, secret: testSecret });

    // 15 seconds later (window difference is at most 1)
    const laterTime = baseTime + 15000;
    const verification = verifyPassToken(token, {
      currentTimestamp: laterTime,
      stepSeconds: 20,
      windowTolerance: 1,
      secret: testSecret,
    });
    expect(verification.valid).toBe(true);
    expect(verification.uuid).toBe(testUuid);
  });

  it("should reject expired screenshots (e.g. 60 seconds later)", () => {
    const baseTime = 1700000000000;
    const { token } = generatePassToken(testUuid, { timestamp: baseTime, stepSeconds: 20, secret: testSecret });

    // 60 seconds later (step difference is 3 steps, tolerance is 1)
    const expiredTime = baseTime + 60000;
    const verification = verifyPassToken(token, {
      currentTimestamp: expiredTime,
      stepSeconds: 20,
      windowTolerance: 1,
      secret: testSecret,
    });
    expect(verification.valid).toBe(false);
    expect(verification.error).toBe("EXPIRED_TOKEN");
    expect(verification.message).toContain("expired");
  });

  it("should reject forged or tampered signatures", () => {
    const now = Date.now();
    const { token } = generatePassToken(testUuid, { timestamp: now, secret: testSecret });

    // Tamper with signature
    const parts = token.split(":");
    parts[4] = "0000000000000000";
    const tamperedToken = parts.join(":");

    const verification = verifyPassToken(tamperedToken, { currentTimestamp: now, secret: testSecret });
    expect(verification.valid).toBe(false);
    expect(verification.error).toBe("INVALID_SIGNATURE");
  });

  it("should gracefully allow backward-compatible legacy raw UUIDs", () => {
    const verification = verifyPassToken(testUuid);
    expect(verification.valid).toBe(true);
    expect(verification.uuid).toBe(testUuid);
    expect(verification.isDynamic).toBe(false);
  });
});
