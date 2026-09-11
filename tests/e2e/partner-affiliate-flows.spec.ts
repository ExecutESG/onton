import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";
import { setupUserTRPCMocks } from "./helpers/trpc-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Role: Partner & Affiliate - Referral Generation, Sharing & Attribution", () => {
  test("Flow P-1: Partner Affiliate Dashboard", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    await page.goto(`${BASE_URL}/my/partner/onion-affiliate`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Partner Affiliate Screen View
    await page.screenshot({ path: "test-results/screenshots/partner_p1_step1_affiliate.png" });
    await page.screenshot({ path: "test-results/screenshots/partner_p1_affiliate.png" });
  });

  test("Flow P-2: Referral Link & Campaign Deep Link Handling", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    // Test entry via affiliate start parameter
    await page.goto(`${BASE_URL}/?tgWebAppStartParam=join-growthpartner2026`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Deeplink Landed Screen
    await page.screenshot({ path: "test-results/screenshots/partner_p2_step1_deeplink.png" });
    await page.screenshot({ path: "test-results/screenshots/partner_p2_deeplink.png" });
  });
});
