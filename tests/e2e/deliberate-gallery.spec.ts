import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";
import { setupUserTRPCMocks } from "./helpers/trpc-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";
const KNOWN_EVENT_UUID = "8a5da15a-6b40-4d0c-8a7c-af0191c81637";

test.describe("Deliberate Quality Portal Screenshots Suite", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // Mobile iPhone/Pixel realistic TMA viewport
  test.setTimeout(90000);

  test("Capture Pristine Guest Discovery Flow (FLOW-G1 to G7)", async ({ page }) => {
    // ----------------------------------------------------
    // FLOW-G1: Homepage Discovery
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // G1 Step 1: Top Hero & Search Bar
    await page.screenshot({ path: "test-results/screenshots/guest_g1_step1_hero.png" });

    // G1 Step 2: Featured Events Carousel (Scroll to featured)
    const featuredSection = page.getByText(/Featured Events/i).first();
    if (await featuredSection.isVisible()) {
      await featuredSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: "test-results/screenshots/guest_g1_step2_featured.png" });
    }

    // G1 Step 3: Ongoing Events Feed
    const eventsHeading = page.getByText(/Featured Contests|Upcoming Events|Ongoing Events|Events/i).first();
    if (await eventsHeading.isVisible()) {
      await eventsHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: "test-results/screenshots/guest_g1_step3_ongoing.png" });
    }

    // G1 Step 4: Navigation Bar
    const navBar = page.locator(".fixed.left-0.bottom-0").or(page.locator("nav")).first();
    if (await navBar.isVisible()) {
      await page.screenshot({ path: "test-results/screenshots/guest_g1_step4_navigation.png" });
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g1_homepage.png" });

    // ----------------------------------------------------
    // FLOW-G2: Search & Clean Category Filtering (NO OVERLAYS)
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/search`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // G2 Step 1: Search Feed Initial
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step1_initial.png" });

    // G2 Step 2: Active query
    const searchInput = page.locator("input[type='text'], input[placeholder*='Search']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Finance");
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step2_query.png" });

    // G2 Step 3: Trigger and capture Filter Drawer (Cleanly Open)
    const filterTrigger = page.locator("button:has(.lucide-sliders-horizontal), .relative.flex.items-center button").first();
    if (await filterTrigger.isVisible()) {
      await filterTrigger.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: "test-results/screenshots/guest_g2_step3_filter_drawer.png" });

      // Dismiss drawer cleanly: click Apply filters or Done, or backdrop
      const closeBtn = page.getByRole("button", { name: /Apply Filters|Done|Close/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click({ timeout: 2000, force: true }).catch(() => {});
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }

      // CRITICAL UX FIX: Wait for sheet animation and backdrop to completely disappear!
      await page.waitForTimeout(800);
    }

    // G2 Step 4: Clean Filtered Results (ZERO OVERLAPPING TEXT)
    await page.screenshot({ path: "test-results/screenshots/guest_g2_step4_results.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g2_search.png" });

    // ----------------------------------------------------
    // FLOW-G3: Event Details & Metadata Inspection
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // G3 Step 1: Hero Banner & Title
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step1_hero.png" });

    // G3 Step 2: Schedule, Location & Price Badge
    const scheduleLoc = page.getByText(/Location|Start Date|Sep 18/i).first();
    if (await scheduleLoc.isVisible()) {
      await scheduleLoc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step2_details.png" });

    // G3 Step 3: Description & About
    const descSection = page.getByText(/Subtitle for test event|About|Description/i).first();
    if (await descSection.isVisible()) {
      await descSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step3_about.png" });

    // G3 Step 4: Organizer Card & RSVP CTA
    const orgCard = page.getByText(/Organizer|Mfarimani|Host/i).first();
    if (await orgCard.isVisible()) {
      await orgCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: "test-results/screenshots/guest_g3_step4_organizer_cta.png" });
    await page.screenshot({ path: "test-results/screenshots/guest_g3_event_details.png" });

    // ----------------------------------------------------
    // FLOW-G7: Gated Actions Trigger WebLoginSheet
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/my`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // G7 Step 1: Login Required Gate
    await page.screenshot({ path: "test-results/screenshots/guest_g7_step1_gated.png" });

    // G7 Step 2: Open WebLoginSheet
    const signInBtn = page.getByRole("button", { name: /Sign In/i }).first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: "test-results/screenshots/guest_g7_step2_login_sheet.png" });
      await page.screenshot({ path: "test-results/screenshots/guest_g7_login_sheet.png" });

      // G7 Step 3: Web3 Connect options
      const web3Card = page.getByText(/TON Connect|Wallet/i).first();
      if (await web3Card.isVisible()) {
        await web3Card.click().catch(() => {});
        await page.waitForTimeout(500);
        await page.screenshot({ path: "test-results/screenshots/guest_g7_step3_web3.png" });
      }
    }
  });

  test("Capture Authenticated Attendee & Quests (FLOW-U1 to U8)", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 23932283,
      first_name: "Mahdi",
      username: "Mfarimani",
      role: "user",
    });
    await setupUserTRPCMocks(page, {
      userId: 23932283,
      username: "Mfarimani",
      firstName: "Mahdi",
      role: "user",
      points: 15400,
    });

    // U1: Profile Hub
    await page.goto(`${BASE_URL}/my`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/user_u1_step1_profile_header.png" });

    // Scroll to activities
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/screenshots/user_u1_step2_activities.png" });

    // Scroll to quests and points
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/screenshots/user_u1_step3_quests_points.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u1_profile.png" });

    // U6: Dynamic QR Ticket Pass
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/user_u3_step1_event_overview.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u3_step2_ticketing.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u3_rsvp.png" });

    // Ticket Pass QR
    await page.screenshot({ path: "test-results/screenshots/user_u6_step1_ticket_qr.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u6_ticket_qr.png" });

    // U7: Quests & Social Tasks
    await page.goto(`${BASE_URL}/quest`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/user_u7_step1_points_header.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u7_quests.png" });

    // U8: Points Engine
    await page.screenshot({ path: "test-results/screenshots/user_u8_step1_balance.png" });
    await page.screenshot({ path: "test-results/screenshots/user_u8_points.png" });
  });

  test("Capture Organizer Event Lifecycle (FLOW-O1 to O3)", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 23932283,
      first_name: "Mahdi",
      username: "Mfarimani",
      role: "admin",
    });
    await setupUserTRPCMocks(page, {
      userId: 23932283,
      username: "Mfarimani",
      role: "admin",
    });

    // O1: Hosted Events Hub
    await page.goto(`${BASE_URL}/my/hosted`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o1_step1_hosted_screen.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o1_hosted.png" });

    // O2: Event Creation Wizard - Step 1: General (Blank Form)
    await page.goto(`${BASE_URL}/events/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step1_general_empty.png" });

    // O2: Fill title & fields
    const titleInput = page.locator("input[placeholder*='Title'], input[name*='title']").first();
    if (await titleInput.isVisible()) {
      await titleInput.fill("ONTON Web3 Builder Night Helsinki");
    }
    const subInput = page.locator("input[placeholder*='Subtitle'], input[name*='subtitle']").first();
    if (await subInput.isVisible()) {
      await subInput.fill("Connect with TON builders and creators");
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step2_general_filled.png" });

    // O2: Step 1 Stepper Footer
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_step3_stepper_footer.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o2_create_event.png" });

    // O3: Management Dashboard on live event
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step1_manage_root.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_manage_root.png" });

    // O3: Guest List
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/guest-list`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step2_guest_list.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_guest_list.png" });

    // O3: Promotion Code
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/promotion-code`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step3_promo_codes.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_promo_codes.png" });

    // O3: Co-organizers & Officers
    await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/co-organizers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_step4_co_organizers.png" });
    await page.screenshot({ path: "test-results/screenshots/organizer_o3_co_organizers.png" });
  });

  test("Capture Platform Admin & Partner Affiliate (FLOW-A & P)", async ({ page }) => {
    await injectTelegramMock(page, {
      id: 23932283,
      username: "Mfarimani",
      role: "admin",
    });
    await setupUserTRPCMocks(page, {
      userId: 23932283,
      username: "Mfarimani",
      role: "admin",
      points: 999999,
    });

    // Admin Access
    await page.goto(`${BASE_URL}/my`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/admin_a2_step1_header.png" });

    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/screenshots/admin_a2_step2_activity.png" });
    await page.screenshot({ path: "test-results/screenshots/admin_a2_profile.png" });

    // Partner Affiliate
    await page.goto(`${BASE_URL}/affiliate`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/partner_p1_step1_affiliate.png" });
    await page.screenshot({ path: "test-results/screenshots/partner_p1_affiliate.png" });

    // Referral Deep Link
    await page.goto(`${BASE_URL}/?start=join-mfarimani`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/screenshots/partner_p2_step1_deeplink.png" });
    await page.screenshot({ path: "test-results/screenshots/partner_p2_deeplink.png" });
  });
});
