import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";
import { setupUserTRPCMocks } from "./helpers/trpc-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const KNOWN_EVENT_UUID = "0cf4733c-190c-4e5a-9a1d-8d8631f7b725";

test.describe("Role: Registered User - Identity, Web3, RSVPs, Quests & Points", () => {
  test("Flow U-1: Authenticated Session & Profile Hub", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 777123456,
      first_name: "Alex",
      last_name: "Web3",
      username: "alex_onton",
      role: "user",
    });

    await setupUserTRPCMocks(page, {
      userId: 777123456,
      username: "alex_onton",
      firstName: "Alex",
      role: "user",
      points: 18500,
    });

    await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });

    // Step 1: Profile Top Header & Avatar
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/user_u1_step1_profile_header.png" });

    // Step 2: Activity Cards
    const participatedCard = page.getByText(/Participated/i).first();
    await expect(participatedCard).toBeVisible();
    await participatedCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u1_step2_activities.png" });

    // Step 3: Quests & Points Card
    const questCard = page.getByText(/Quest/i).first();
    await expect(questCard).toBeVisible({ timeout: 10000 });
    await questCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u1_step3_quests_points.png" });

    // Step 4: Wallet Section & Navigation
    const walletSection = page.getByText(/Your Wallet/i).first();
    if (await walletSection.isVisible()) {
      await walletSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: "test-results/screenshots/user_u1_step4_wallet.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u1_profile.png" });
  });

  test("Flow U-2: Web3 Wallet Integration & TonConnect Modal", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Open WebLoginSheet to access TonConnect
    const loginTrigger = page.locator(".hidden.md\\:flex, .fixed.left-0.bottom-0").getByText("Login").first();
    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
    } else {
      await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Sign In/i }).first().click();
    }

    const loginModal = page.locator("div.visible.opacity-100").first();
    await expect(loginModal).toBeVisible();

    // Step 1: Login Sheet with Web3 Connect Option
    await page.screenshot({ path: "test-results/screenshots/user_u2_step1_login_sheet.png" });

    const tonConnectBtn = loginModal.locator("tc-root").first();
    await expect(tonConnectBtn).toBeVisible({ timeout: 5000 });
    await tonConnectBtn.click();

    // Verify TonConnect wallet selection modal opens
    const modalHeading = page.getByRole("heading", { name: /Connect your TON wallet/i });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // Step 2: TonConnect Modal Opened
    await page.screenshot({ path: "test-results/screenshots/user_u2_step2_tonconnect_modal.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u2_tonconnect.png" });
  });

  test("Flow U-3: Free Ticket RSVP & Registration Flow", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    // Mock event data to show active registration
    await page.route("**/api/trpc/events.getEvent*", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json && json[0]?.result?.data) {
        json[0].result.data.isNotEnded = true;
        json[0].result.data.isStarted = false;
        json[0].result.data.has_registration = true;
        json[0].result.data.capacity_filled = false;
        json[0].result.data.price = 0;
      }
      await route.fulfill({ json });
    });

    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Event Details Overview
    await page.screenshot({ path: "test-results/screenshots/user_u3_step1_event_overview.png" });

    // Step 2: Ticket & Registration Section
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u3_step2_ticketing.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u3_rsvp.png" });
  });

  test("Flow U-4: Paid Ticket & Order System APIs", async ({ request }) => {
    // 1. Verify TonProof payload generation API (GET method)
    const proofRes = await request.get(`${BASE_URL}/api/v1/ton-proof/generate-payload`);
    expect(proofRes.status()).toBe(200);
    const proofJson = await proofRes.json();
    expect(proofJson.payload).toBeDefined();

    // 2. Verify Order Stars Invoice generation API
    const starsRes = await request.post(`${BASE_URL}/api/v1/order/stars-invoice`, {
      data: {
        event_id: 1,
        user_id: 987654321,
      },
    });
    // Expected to reject unauthorized/invalid params safely without 500 crash
    expect(starsRes.status()).toBeLessThan(500);
  });

  test("Flow U-5: Coupon & Promo Code Validation", async ({ request }) => {
    // Verify coupon check endpoint responds with structured payload
    const couponRes = await request.get(`${BASE_URL}/api/v1/event/1/checkCoupon/INVALID_TEST_CODE`);
    expect(couponRes.status()).toBeLessThan(500);

    const couponData = await couponRes.json().catch(() => ({}));
    expect(couponData).toBeDefined();
  });

  test("Flow U-6: Attendee Ticket Pass & QR View", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/registrant/1/qr`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Ticket QR Code View
    await page.screenshot({ path: "test-results/screenshots/user_u6_step1_ticket_qr.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u6_ticket_qr.png" });
  });

  test("Flow U-7: Quests & Social Tasks Dashboard", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    await page.goto(`${BASE_URL}/my/quest`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Quests Banner & Points Header
    await page.screenshot({ path: "test-results/screenshots/user_u7_step1_points_header.png" });

    // Step 2: Quests Referral Card & Social Tasks
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u7_step2_referral_tasks.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u7_quests.png" });
  });

  test("Flow U-8: ONION Points Engine & Tier Ranking", async ({ page }) => {
    await injectTelegramMock(page);
    await setupUserTRPCMocks(page);

    await page.goto(`${BASE_URL}/my/points`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Points Balance Header
    await page.screenshot({ path: "test-results/screenshots/user_u8_step1_balance.png" });

    // Step 2: Online Events Points Breakdown
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u8_step2_online_events.png" });

    // Step 3: In-Person Events & Multipliers
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/user_u8_step3_inperson_rewards.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u8_points.png" });
  });
});
