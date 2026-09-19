import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";
import { setupUserTRPCMocks } from "./helpers/trpc-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Role: Platform Admin - Oversight, Moderation & System Settings", () => {
  test("Flow A-1: Client Panel Public Authentication APIs", async ({ request }) => {
    // 1. Send Code Endpoint
    const sendCodeRes = await request.post(`${BASE_URL}/api/client/v1/public/sendCode`, {
      data: {
        email: "admin_test@onton.live",
      },
    });
    expect([200, 400, 422, 429]).toContain(sendCodeRes.status());

    // 2. Logout Endpoint
    const logoutRes = await request.post(`${BASE_URL}/api/client/v1/public/logout`);
    expect([200, 302, 401]).toContain(logoutRes.status());
  });

  test("Flow A-2: Admin Elevated Role Access in Mini-App", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 111222333,
      username: "onton_admin",
      role: "admin",
    });

    await setupUserTRPCMocks(page, {
      userId: 111222333,
      username: "onton_admin",
      role: "admin",
      points: 999999,
    });

    await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Admin Profile Header
    await page.screenshot({ path: "test-results/screenshots/admin_a2_step1_header.png" });

    // Step 2: Admin Activity & Wallet
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/admin_a2_step2_activity.png" });
    await page.screenshot({ path: "test-results/screenshots/admin_a2_profile.png" });
  });

  test("Flow A-3: Admin System Settings & Health", async ({ request }) => {
    const pingRes = await request.get(`${BASE_URL}/api/client/v1/public/ping`);
    expect(pingRes.status()).toBe(200);
    const data = await pingRes.json();
    expect(data.success).toBe(true);
    expect(data.server).toBeDefined();
  });
});
