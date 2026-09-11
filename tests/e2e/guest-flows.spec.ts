import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const KNOWN_EVENT_UUID = "0cf4733c-190c-4e5a-9a1d-8d8631f7b725";

test.describe("Role: Guest - Ecosystem Discovery & Navigation", () => {
  test("Flow G-1: Homepage Feed & Promoted Content", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(/ONTON/i);

    // Step 1: Homepage Top View (Hero & Search)
    await page.screenshot({ path: "test-results/screenshots/guest_g1_step1_hero.png" });

    // Step 2: Featured Events Section
    const featuredHeading = page.getByText(/Featured Events/i).first();
    await expect(featuredHeading).toBeVisible();
    await featuredHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/guest_g1_step2_featured.png" });

    // Step 3: Ongoing Events Feed
    const eventsHeading = page.getByText(/Featured Contests|Upcoming Events|Ongoing Events/i).first();
    await expect(eventsHeading).toBeVisible();
    await eventsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/guest_g1_step3_ongoing.png" });

    // Step 4: Bottom Navigation & Overall View
    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    const navBar = isMobile ? page.locator(".fixed.left-0.bottom-0") : page.locator(".hidden.md\\:flex");
    await expect(navBar).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/guest_g1_step4_navigation.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g1_homepage.png" });
  });

  test("Flow G-2: Global Search & Filtering", async ({ page }) => {
    await page.goto(`${BASE_URL}/search`, { waitUntil: "networkidle" });

    // Step 1: Initial Search Screen
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step1_initial.png" });

    // Step 2: Type search query
    const searchInput = page.locator("input[type='text'], input[placeholder*='Search']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Finance");
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step2_query.png" });

    // Step 3: Trigger Filters Drawer
    const filterTrigger = page.locator(".relative.flex.items-center button").first();
    if (await filterTrigger.isVisible()) {
      await filterTrigger.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/screenshots/guest_g2_step3_filter_drawer.png" });
      
      // Close drawer or click backdrop to view results cleanly
      const closeOrDone = page.getByRole("button", { name: /Done|Apply filters/i }).first();
      if (await closeOrDone.isVisible()) {
        await closeOrDone.click().catch(() => {});
      }
    }

    // Step 4: Matching Search Results
    const eventCards = page.locator(".cursor-pointer:has-text('Free'), .cursor-pointer:has-text('The Future')");
    await expect(eventCards.first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step4_results.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g2_search.png" });
  });

  test("Flow G-3: Event Details & Ticketing Options", async ({ page }) => {
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "networkidle" });

    // Step 1: Hero Banner & Title
    const heroImage = page.locator("img[alt*='Event Image']").first();
    await expect(heroImage).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step1_hero.png" });

    // Step 2: Event Details, Date, Time & Location
    await expect(page.getByText(/Ticket Price/i).first()).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step2_details.png" });

    // Step 3: About & Panelists Section
    const aboutSection = page.getByText(/About/i).first();
    if (await aboutSection.isVisible()) {
      await aboutSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step3_about.png" });

    // Step 4: Organizer & Action Section
    const organizerCard = page.getByText(/Organizer/i).first();
    await expect(organizerCard).toBeVisible();
    await organizerCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step4_organizer_cta.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g3_event_details.png" });
  });

  test("Flow G-4: Organizer Channels Discovery", async ({ page }) => {
    await page.goto(`${BASE_URL}/channels`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Top Channels Feed
    await page.screenshot({ path: "test-results/screenshots/guest_g4_step1_top.png" });

    // Step 2: Scrolled Channels Grid
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/guest_g4_step2_scrolled.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g4_channels.png" });
  });

  test("Flow G-5: Play2Win Tournaments & Global Leaderboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/play-2-win`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();

    // Step 1: Play2Win Header & Filters
    await page.screenshot({ path: "test-results/screenshots/guest_g5_step1_header.png" });

    // Step 2: Tournament Container
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/screenshots/guest_g5_step2_games.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g5_play2win.png" });
  });

  test("Flow G-6: Growth & Campaign Landing Pages", async ({ page }) => {
    // Step 1: Genesis Onions
    await page.goto(`${BASE_URL}/genesis-onions`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/guest_g6_step1_genesis.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g6_genesis_onions.png" });

    // Step 2: Onion Snapshot
    await page.goto(`${BASE_URL}/onion-snapshot`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/guest_g6_step2_snapshot.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g6_onion_snapshot.png" });

    // Step 3: Glossary
    await page.goto(`${BASE_URL}/glossary`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/guest_g6_step3_glossary.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g6_glossary.png" });
  });

  test("Flow G-7: Gated Actions Trigger WebLoginSheet", async ({ page }) => {
    await page.goto(`${BASE_URL}/my`, { waitUntil: "networkidle" });

    // Step 1: Gated Profile Gate Screen
    await page.screenshot({ path: "test-results/screenshots/guest_g7_step1_gated.png" });

    // Step 2: Click Sign In to open Login Sheet
    const signInBtn = page.getByRole("button", { name: /Sign In to ONTON|Sign In/i }).first();
    await expect(signInBtn).toBeVisible({ timeout: 8000 });
    await signInBtn.click();

    // Verify WebLoginSheet opens
    const loginModal = page.locator("div.visible.opacity-100").or(page.locator("[role='dialog']")).first();
    await expect(loginModal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/screenshots/guest_g7_step2_login_sheet.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g7_login_sheet.png" });

    // Step 3: Web3 Connect Option Click
    const web3Btn = loginModal.getByText(/Connect Wallet|tc-root/i).first();
    if (await web3Btn.isVisible()) {
      await web3Btn.click().catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/screenshots/guest_g7_step3_web3.png" });
    }
  });
});
