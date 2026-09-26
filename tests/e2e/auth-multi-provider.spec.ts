import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Multi-Provider Identity & Authentication Suite", () => {
  test("AUTH-1: POST /api/v1/auth/email/send-otp validates mandatory email parameter", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/email/send-otp`, {
      data: { email: "" },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Missing required parameter: email");
  });

  test("AUTH-2: POST /api/v1/auth/email/send-otp generates OTP challenge for valid email", async ({ request }) => {
    const testEmail = `qa-audit-${Date.now()}@onton.live`;
    const response = await request.post(`${BASE_URL}/api/v1/auth/email/send-otp`, {
      data: { email: testEmail },
      headers: { "Content-Type": "application/json" },
    });

    // 200 on success, or 429 if IP rate limited
    expect([200, 429]).toContain(response.status());
    const json = await response.json();
    if (response.status() === 200) {
      expect(json.success).toBe(true);
      expect(json.message).toBeDefined();
    }
  });

  test("AUTH-3: POST /api/v1/auth/email/verify-otp rejects unissued or incorrect OTP code", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/email/verify-otp`, {
      data: {
        email: "unissued-test-user@onton.live",
        code: "000000",
      },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/(expired|not found|Invalid)/i);
  });

  test("AUTH-4: GET /api/v1/auth/me rejects requests without valid session cookie/header", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/auth/me`);
    expect(response.status()).toBe(401);

    const json = await response.json();
    expect(json.error).toContain("Unauthorized");
  });

  test("AUTH-5: POST /api/v1/auth/telegram rejects invalid HMAC signature in initData", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/telegram`, {
      data: {
        init_data: "user=%7B%22id%22%3A12345%7D&auth_date=1600000000&hash=tampered_hex_hash",
      },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.error).toContain("Invalid or expired Telegram initData");
  });
});
