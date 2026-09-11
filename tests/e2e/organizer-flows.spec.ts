import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";
import { setupUserTRPCMocks } from "./helpers/trpc-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const KNOWN_EVENT_UUID = "0cf4733c-190c-4e5a-9a1d-8d8631f7b725";

test.describe("Role: Event Organizer - Creation, Management, Guest List & Analytics", () => {
  test("Flow O-1: Hosted Events Hub", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 999888777,
      first_name: "Sarah",
      username: "sarah_organizer",
      role: "organizer",
    });

    await setupUserTRPCMocks(page, {
      userId: 999888777,
      role: "organizer",
      username: "sarah_organizer",
      firstName: "Sarah",
    });

    await page.goto(`${BASE_URL}/my/hosted`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Hosted Events Overview
    await page.screenshot({ path: "test-results/screenshots/organizer_o1_step1_hosted_screen.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o1_hosted.png" });
  });

  test("Flow O-2: Event Creation Wizard", async ({ page }) => {
    await injectTelegramMock(page, { role: "organizer" });
    await setupUserTRPCMocks(page, { role: "organizer" });

    await page.goto(`${BASE_URL}/events/create`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Step 1 General Initial Form
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step1_general_empty.png" });

    // Step 2: Fill Title & Fields
    const titleInput = page.locator("input[placeholder*='Title'], input[name*='title']").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("TON Growth Summit 2026");
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step2_general_filled.png" });

    // Step 3: Terms & Image Upload Section
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step3_stepper_footer.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_create_event.png" });
  });

  test("Flow O-3: Event Management Dashboard & Sub-modules", async ({ page }) => {
    await injectTelegramMock(page, { role: "organizer" });
    await setupUserTRPCMocks(page, { role: "organizer" });

    // Step 1: Management Root
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step1_manage_root.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_manage_root.png" });

    // Step 2: Guest List View
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/guest-list`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step2_guest_list.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_guest_list.png" });

    // Step 3: Promotion Code Management
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/promotion-code`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step3_promo_codes.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_promo_codes.png" });

    // Step 4: Co-organizers & Officers
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/co-organizers`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step4_co_organizers.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_co_organizers.png" });
  });

  test("Flow O-4: Guest List Export Endpoint", async ({ request }) => {
    const exportRes = await request.get(`${BASE_URL}/api/v1/getEventExport?event_uuid=${KNOWN_EVENT_UUID}`);
    expect(exportRes.status()).toBeLessThan(500);
  });
});
