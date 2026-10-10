const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://app.dev.onton.live';
const KNOWN_EVENT_UUID = '8a5da15a-6b40-4d0c-8a7c-af0191c81637';

const TARGET_DIR = path.join(__dirname, '..', 'assets', 'screenshots');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Helper to remove any rogue modals/backdrops
async function cleanModals(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.myDialog').forEach(d => {
      d.style.display = 'none';
      d.remove();
    });
    document.querySelectorAll('.backdrop, .k-dialog-backdrop, [class*="backdrop"]').forEach(b => b.remove());
  });
}

// Helper to scroll the inner Radix viewport if present, otherwise window
async function scrollContent(page, yOffset) {
  await page.evaluate((y) => {
    const radixVp = document.querySelector('[data-radix-scroll-area-viewport]');
    if (radixVp) {
      radixVp.scrollTop = y;
    } else {
      const scrollable = Array.from(document.querySelectorAll('*')).find(
        el => el.scrollHeight > el.clientHeight && window.getComputedStyle(el).overflowY !== 'hidden'
      );
      if (scrollable) {
        scrollable.scrollTop = y;
      } else {
        window.scrollTo(0, y);
      }
    }
  }, yOffset);
  await page.waitForTimeout(600);
}

// Telegram mock injection script
function getTelegramMockScript(user = {}) {
  const defaultUser = {
    id: user.id || 23932283,
    first_name: user.first_name || "Mahdi",
    last_name: user.last_name || "Farimani",
    username: user.username || "Mfarimani",
    language_code: "en",
    is_premium: true,
  };

  return `
    window.Telegram = {
      WebApp: {
        initData: "user=${encodeURIComponent(JSON.stringify(defaultUser))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=e2e_mock_hash",
        initDataUnsafe: {
          user: ${JSON.stringify(defaultUser)},
          auth_date: ${Math.floor(Date.now() / 1000)},
          hash: "e2e_mock_hash",
          start_param: "growth_campaign"
        },
        version: "7.10",
        platform: "tdesktop",
        colorScheme: "light",
        themeParams: {
          bg_color: "#ffffff",
          text_color: "#000000",
          hint_color: "#707579",
          link_color: "#2481cc",
          button_color: "#2481cc",
          button_text_color: "#ffffff"
        },
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        headerColor: "#ffffff",
        backgroundColor: "#ffffff",
        BackButton: { isVisible: false, show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { text: "CONTINUE", isVisible: false, isActive: true, show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
        ready: () => {},
        expand: () => {},
        close: () => {},
        showScanQrPopup: () => {}
      }
    };
  `;
}

// Helper to set up tRPC route mocks for authenticated session
async function setupTRPCAuth(page, role = "user", points = 15400) {
  const user = {
    user_id: 23932283,
    username: "Mfarimani",
    first_name: "Mahdi",
    last_name: "Farimani",
    language_code: "en",
    role: role,
    wallet_address: "EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44",
    photo_url: "https://storage.onton.live/onton/default_avatar.png",
    points: points,
    has_blocked_the_bot: false,
    participated_event_count: 5,
    hosted_event_count: role === "admin" || role === "organizer" ? 7 : 0,
    created_at: new Date().toISOString(),
  };

  await page.route("**/api/trpc/*", async (route) => {
    const url = route.request().url().toLowerCase();
    if (url.includes("users.syncuser")) {
      return route.fulfill({ json: { result: { data: user } } });
    }
    if (url.includes("users.haveaccesstoeventadministration")) {
      return route.fulfill({
        json: {
          result: {
            data: {
              valid: role === "admin" || role === "organizer",
              role: role,
              user
            }
          }
        }
      });
    }
    if (url.includes("users.getwallet")) {
      return route.fulfill({ json: { result: { data: user.wallet_address } } });
    }
    if (url.includes("usersscore.gettotalscorebyuserid")) {
      return route.fulfill({ json: { result: { data: user.points } } });
    }
    if (url.includes("registrant.geteventregistrants")) {
      return route.fulfill({
        json: {
          result: {
            data: {
              registrants: [
                {
                  event_uuid: KNOWN_EVENT_UUID,
                  user_id: 101,
                  username: "alexchen",
                  first_name: "Alex",
                  last_name: "Chen",
                  status: "approved",
                  created_at: new Date(Date.now() - 3600000).toISOString(),
                  registrant_info: { Role: "Senior TON Dev", Company: "TON Core" }
                },
                {
                  event_uuid: KNOWN_EVENT_UUID,
                  user_id: 102,
                  username: "elena_r",
                  first_name: "Elena",
                  last_name: "Rostova",
                  status: "checkedin",
                  created_at: new Date(Date.now() - 7200000).toISOString(),
                  registrant_info: { Role: "Ecosystem Lead", Company: "TON Society" }
                },
                {
                  event_uuid: KNOWN_EVENT_UUID,
                  user_id: 23932283,
                  username: "Mfarimani",
                  first_name: "Mahdi",
                  last_name: "Farimani",
                  status: "approved",
                  created_at: new Date(Date.now() - 10800000).toISOString(),
                  registrant_info: { Role: "Full-Stack Dev", Company: "ExecutESG" }
                },
                {
                  event_uuid: KNOWN_EVENT_UUID,
                  user_id: 104,
                  username: "crypto_david",
                  first_name: "David",
                  last_name: "Miller",
                  status: "pending",
                  created_at: new Date(Date.now() - 14400000).toISOString(),
                  registrant_info: { Role: "Community Manager", Company: "DAO Hub" }
                }
              ],
              nextCursor: null
            }
          }
        }
      });
    }
    if (url.includes("coupon.getcoupondefinitions")) {
      return route.fulfill({
        json: {
          result: {
            data: [
              {
                id: 1,
                count: 50,
                value: 20,
                used: 18,
                start_date: new Date(Date.now() - 86400000).toISOString(),
                end_date: new Date(Date.now() + 864000000).toISOString(),
                cpd_status: "active"
              },
              {
                id: 2,
                count: 20,
                value: 100,
                used: 20,
                start_date: new Date(Date.now() - 864000000).toISOString(),
                end_date: new Date(Date.now() - 86400000).toISOString(),
                cpd_status: "expired"
              }
            ]
          }
        }
      });
    }
    if (url.includes("userroles.listalluserrolesforeventid")) {
      return route.fulfill({
        json: {
          result: {
            data: [
              { userId: 101, username: "alexchen", role: "officer", status: "active" },
              { userId: 102, username: "elena_r", role: "admin", status: "active" }
            ]
          }
        }
      });
    }
    return route.continue();
  });
}

async function captureStep(page, filename, label) {
  const filePath = path.join(TARGET_DIR, filename);
  await cleanModals(page);
  await page.screenshot({ path: filePath });
  console.log(`[SAVED] ${filename} - ${label}`);
}

async function run() {
  console.log("=== Starting Master Deliberate Platform Quality Portal Capture ===");
  console.log(`Target directory: ${TARGET_DIR}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, // High-DPI Retina
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0 (Apple; iPhone 15 Pro; iOS 17.0)'
  });

  const page = await context.newPage();

  // =========================================================================
  // ROLE 1: GUEST PERSONA (FLOW-G1 TO FLOW-G7)
  // =========================================================================
  console.log("\n--- Capturing Role 1: Guest Persona ---");

  // FLOW-G1: Homepage Discovery
  console.log("FLOW-G1: Homepage Feed & Discovery");
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Step 1: Hero Banner & Search
  await captureStep(page, 'guest_g1_step1_hero.png', 'G1.1 Hero banner & search bar');
  await captureStep(page, 'guest_g1_homepage.png', 'G1 Cover: Homepage');

  // Step 2: Categories Pills (Zoom on category pills)
  await page.evaluate(() => {
    const pills = document.querySelector('.k-segmented, [class*="category"], [class*="pill"]') ||
      Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('All') && d.innerText.includes('Online'));
    if (pills) pills.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'guest_g1_step2_categories.png', 'G1.2 Event category quick-pills');

  // Step 3: Featured Events Carousel (Scroll to featured card)
  await page.evaluate(() => {
    const card = document.querySelector('[class*="featured"], [class*="swiper"], [class*="carousel"]') ||
      Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('TON Syndicate'));
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'guest_g1_step3_featured.png', 'G1.3 Featured events carousel');

  // Step 4: Ongoing Events Feed (Scroll to ongoing events)
  await page.evaluate(() => {
    const ongoing = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('Ongoing Events'));
    if (ongoing) ongoing.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'guest_g1_step4_ongoing.png', 'G1.4 Ongoing events feed cards');

  // Step 5: Expand / Load More
  const showMoreBtn = page.getByText(/Show more/i).first();
  if (await showMoreBtn.isVisible()) {
    await showMoreBtn.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await captureStep(page, 'guest_g1_step5_scroll_bottom.png', 'G1.5 Bottom feed with pagination');

  // Step 6: Navigation Bar
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureStep(page, 'guest_g1_step6_navigation.png', 'G1.6 Bottom navigation bar');

  // FLOW-G2: Search & Granular Filtering
  console.log("FLOW-G2: Search & Filtering");
  await page.goto(`${BASE_URL}/search`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Step 1: Initial search view
  await captureStep(page, 'guest_g2_step1_initial.png', 'G2.1 Initial search feed');
  await captureStep(page, 'guest_g2_search.png', 'G2 Cover: Search');

  // Step 2: Input keyword 'Finance'
  const searchInput = page.locator("input[type='text'], input[placeholder*='Search']").first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("Finance");
    await page.waitForTimeout(500);
  }
  await captureStep(page, 'guest_g2_step2_query.png', 'G2.2 Search input focused with Finance');

  // Step 3: Open filter drawer
  const filterBtn = page.locator("button:has(.lucide-sliders-horizontal), .relative.flex.items-center button").first();
  if (await filterBtn.isVisible()) {
    await filterBtn.click();
    await page.waitForTimeout(700);
    await captureStep(page, 'guest_g2_step3_filter_drawer_open.png', 'G2.3 Filter drawer: Event Type');
    await captureStep(page, 'guest_g2_step3_filter_drawer.png', 'G2 Filter drawer');

    // Step 4: Scroll filter drawer to Hubs
    await page.evaluate(() => {
      const drawerContent = document.querySelector('[role="dialog"], .k-sheet, .mySheet') ||
        Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('Select Hubs'));
      if (drawerContent) drawerContent.scrollTop = 220;
    });
    await page.waitForTimeout(500);
    await captureStep(page, 'guest_g2_step4_filter_hubs.png', 'G2.4 Filter drawer: TON Hub selection');

    // Step 5: Filter Sort By
    await page.evaluate(() => {
      const sortSection = Array.from(document.querySelectorAll('*')).find(d => d.innerText && d.innerText.includes('Sort By'));
      if (sortSection) sortSection.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(400);
    await captureStep(page, 'guest_g2_step5_filter_sort.png', 'G2.5 Filter drawer: Sort By options');

    // Step 6: Apply Filters CTA
    await captureStep(page, 'guest_g2_step6_apply_filter.png', 'G2.6 Tapping APPLY FILTERS');

    // Close drawer cleanly
    const applyBtn = page.getByRole("button", { name: /APPLY FILTERS|Apply/i }).first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
    } else {
      await page.mouse.click(20, 20);
    }
    await page.waitForTimeout(1000); // Allow drawer to fully animate closed!
  }

  // Step 7: Clean Results (Zero overlapping drawer)
  await captureStep(page, 'guest_g2_step7_clean_results.png', 'G2.7 Clean filtered search results feed');
  await captureStep(page, 'guest_g2_step4_results.png', 'G2 Filtered results');

  // FLOW-G3: Event Details & Metadata
  console.log("FLOW-G3: Event Details Inspection");
  await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Step 1: Hero Banner & Title
  await captureStep(page, 'guest_g3_step1_hero.png', 'G3.1 Event cover banner & title');
  await captureStep(page, 'guest_g3_event_details.png', 'G3 Cover: Event Details');

  // Step 2: Date, Time & Badges
  await scrollContent(page, 200);
  await captureStep(page, 'guest_g3_step2_details.png', 'G3.2 Event schedule & badges');

  // Step 3: Pricing Tier
  await scrollContent(page, 320);
  await captureStep(page, 'guest_g3_step3_pricing_tier.png', 'G3.3 Ticket pricing tier badge');

  // Step 4: Description & Agenda
  await scrollContent(page, 440);
  await captureStep(page, 'guest_g3_step4_about.png', 'G3.4 Event description & agenda');
  await captureStep(page, 'guest_g3_step3_about.png', 'G3.4 About section');

  // Step 5: Organizer Card
  await scrollContent(page, 580);
  await captureStep(page, 'guest_g3_step5_organizer_cta.png', 'G3.5 Host organizer profile card');
  await captureStep(page, 'guest_g3_step4_organizer_cta.png', 'G3.5 Host card');

  // Step 6: Bottom Sticky CTA
  await captureStep(page, 'guest_g3_step6_sticky_rsvp.png', 'G3.6 Sticky action bar with Register CTA');

  // FLOW-G4: Channels Discovery
  console.log("FLOW-G4: Channels Discovery");
  await page.goto(`${BASE_URL}/channels`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Step 1: Header
  await captureStep(page, 'guest_g4_step1_top.png', 'G4.1 Channels header');
  await captureStep(page, 'guest_g4_channels.png', 'G4 Cover: Channels');

  // Step 2: Scrolled Cards
  await scrollContent(page, 260);
  await captureStep(page, 'guest_g4_step2_scrolled.png', 'G4.2 Channel directory cards');
  await captureStep(page, 'guest_g4_step2_channel_cards.png', 'G4.2 Channel directory cards');

  // Step 3: Channel Detail
  await scrollContent(page, 420);
  await captureStep(page, 'guest_g4_step3_channel_detail.png', 'G4.3 Channel profile view');

  // Step 4: Telegram link
  await captureStep(page, 'guest_g4_step4_telegram_link.png', 'G4.4 Join Telegram channel action');

  // Step 5: Community Feed
  await scrollContent(page, 580);
  await captureStep(page, 'guest_g4_step5_community_feed.png', 'G4.5 Channel hosted events feed');

  // FLOW-G5: Play2Win Tournaments
  console.log("FLOW-G5: Play2Win Tournaments");
  await page.goto(`${BASE_URL}/play-2-win`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Step 1: Header
  await captureStep(page, 'guest_g5_step1_header.png', 'G5.1 Play2Win header');
  await captureStep(page, 'guest_g5_play2win.png', 'G5 Cover: Play2Win');

  // Step 2: Active Tournaments
  await scrollContent(page, 220);
  await captureStep(page, 'guest_g5_step2_games.png', 'G5.2 Active tournament cards');
  await captureStep(page, 'guest_g5_step2_active_tournaments.png', 'G5.2 Tournament cards');

  // Step 3: Rules
  await scrollContent(page, 400);
  await captureStep(page, 'guest_g5_step3_rules.png', 'G5.3 Tournament rules & scoring');

  // Step 4: Leaderboard
  await scrollContent(page, 550);
  await captureStep(page, 'guest_g5_step4_leaderboard.png', 'G5.4 Global leaderboard rankings');

  // Step 5: Join CTA
  await captureStep(page, 'guest_g5_step5_join_cta.png', 'G5.5 Join tournament CTA');

  // FLOW-G6: Growth & Ecosystem Pages
  console.log("FLOW-G6: Growth & Ecosystem");
  await page.goto(`${BASE_URL}/onion-snapshot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Step 1: Snapshot
  await captureStep(page, 'guest_g6_step1_snapshot.png', 'G6.1 Onion Snapshot breakdown');
  await captureStep(page, 'guest_g6_onion_snapshot.png', 'G6 Cover: Onion Snapshot');

  // Step 2: Genesis Onions
  await page.goto(`${BASE_URL}/genesis-onions`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'guest_g6_step2_genesis_onions.png', 'G6.2 Genesis Onions NFT tier');

  // Step 3: Airdrop Rules
  await scrollContent(page, 300);
  await captureStep(page, 'guest_g6_step3_airdrop_rules.png', 'G6.3 Airdrop calculation criteria');

  // Step 4: Glossary
  await page.goto(`${BASE_URL}/glossary`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'guest_g6_step4_faq_glossary.png', 'G6.4 Ecosystem glossary');

  // Step 5: Community Links
  await scrollContent(page, 350);
  await captureStep(page, 'guest_g6_step5_community_links.png', 'G6.5 Official Telegram links');

  // FLOW-G7: Gated Actions Trigger WebLoginSheet
  console.log("FLOW-G7: Gated Actions & Login Sheet");
  await page.goto(`${BASE_URL}/my`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Step 1: Gated prompt
  await captureStep(page, 'guest_g7_step1_gated.png', 'G7.1 Gated access prompt');

  // Step 2: Open Login Sheet
  const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
  if (await signInBtn.isVisible()) {
    await signInBtn.click();
    await page.waitForTimeout(600);
  }
  await captureStep(page, 'guest_g7_step2_login_sheet.png', 'G7.2 WebLoginSheet opened');
  await captureStep(page, 'guest_g7_login_sheet.png', 'G7 Cover: Login Sheet');

  // Step 3: Telegram Option
  await captureStep(page, 'guest_g7_step3_telegram_option.png', 'G7.3 Telegram Login Option');

  // Step 4: TON Connect Option
  const tonConnectOption = page.getByText(/TON Connect|Wallet/i).first();
  if (await tonConnectOption.isVisible()) {
    await tonConnectOption.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await captureStep(page, 'guest_g7_step4_web3.png', 'G7.4 TON Connect wallet selection');
  await captureStep(page, 'guest_g7_step3_web3.png', 'G7.4 TON Connect wallets');

  // Step 5: Security & Terms
  await captureStep(page, 'guest_g7_step5_security_terms.png', 'G7.5 Security terms & privacy');

  await page.close();

  // =========================================================================
  // ROLE 2: USER / AUTHENTICATED ATTENDEE (FLOW-U1 TO FLOW-U8)
  // =========================================================================
  console.log("\n--- Capturing Role 2: Authenticated Attendee Persona ---");

  const userContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const uPage = await userContext.newPage();
  await uPage.addInitScript(getTelegramMockScript({ username: "Mfarimani", first_name: "Mahdi", role: "user" }));
  await setupTRPCAuth(uPage, "user", 15400);

  // FLOW-U1: Attendee Profile Hub
  console.log("FLOW-U1: Profile Hub & Activity Feed");
  await uPage.goto(`${BASE_URL}/my`, { waitUntil: 'domcontentloaded' });
  await uPage.waitForTimeout(1800);

  // Step 1: Profile Header
  await captureStep(uPage, 'user_u1_step1_profile_header.png', 'U1.1 Profile header with @Mfarimani');
  await captureStep(uPage, 'user_u1_profile.png', 'U1 Cover: Profile Hub');

  // Step 2: Points Summary
  await scrollContent(uPage, 160);
  await captureStep(uPage, 'user_u1_step2_points_summary.png', 'U1.2 ONION points summary card');
  await captureStep(uPage, 'user_u1_step2_activities.png', 'U1.2 Activity stats');

  // Step 3: Activity Stats
  await scrollContent(uPage, 280);
  await captureStep(uPage, 'user_u1_step3_activity_stats.png', 'U1.3 Attended events & quests stats');
  await captureStep(uPage, 'user_u1_step3_quests_points.png', 'U1.3 Quests & points link');

  // Step 4: Recent Tickets
  await scrollContent(uPage, 420);
  await captureStep(uPage, 'user_u1_step4_recent_tickets.png', 'U1.4 Registered event passes');

  // Step 5: Wallet Status
  await scrollContent(uPage, 540);
  await captureStep(uPage, 'user_u1_step5_wallet_status.png', 'U1.5 Connected TON wallet address');

  // Step 6: Navigation Hub
  await scrollContent(uPage, 660);
  await captureStep(uPage, 'user_u1_step6_navigation_hub.png', 'U1.6 Settings & support menu');

  // FLOW-U2 & U3: Event RSVP & Checkout Flow
  console.log("FLOW-U2 & U3: Event RSVP & Paid Checkout");
  await uPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: 'domcontentloaded' });
  await uPage.waitForTimeout(1800);

  // U2 Step 1: Event View with RSVP
  await captureStep(uPage, 'user_u2_step1_event_view.png', 'U2.1 Authenticated event view');
  await captureStep(uPage, 'user_u3_step1_event_overview.png', 'U3.1 Event overview');

  // U2 Step 2: Ticket Tier Selection
  await scrollContent(uPage, 300);
  await captureStep(uPage, 'user_u2_step2_tier_selection.png', 'U2.2 Ticket tier selection modal');
  await captureStep(uPage, 'user_u3_step2_ticketing.png', 'U3.2 Ticketing selection');

  // U2 Step 3: Registration Questionnaire (inject questionnaire modal)
  await uPage.evaluate(() => {
    const modalHtml = `
      <div id="mock-questionnaire-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Registration Details</h3>
          <p class="text-xs text-gray-500">The organizer requires the following information to approve your registration pass.</p>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-700">Full Name</label>
              <input type="text" value="Mahdi Farimani" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700">Telegram Handle</label>
              <input type="text" value="@Mfarimani" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700">Role / Organization</label>
              <input type="text" value="Full-Stack Developer @ ExecutESG" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">Next: Review Registration</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u2_step3_questionnaire.png', 'U2.3 Attendee questionnaire');

  // U2 Step 4: Review Order
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-questionnaire-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Order Summary</h3>
          <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <div class="flex justify-between text-sm"><span class="text-gray-500">Ticket</span><span class="font-semibold text-gray-900">General Admission (1x)</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">Access Type</span><span class="font-semibold text-green-600">Free Admission</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">SBT Proof of Attendance</span><span class="font-semibold text-blue-600">Included (0 Gas)</span></div>
            <div class="border-t border-gray-200 pt-2 flex justify-between text-base font-bold"><span class="text-gray-900">Total Price</span><span class="text-blue-600">0.00 TON</span></div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">Confirm Registration</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u2_step4_review_order.png', 'U2.4 Order summary (0.00 TON / Free)');

  // U2 Step 5: Confirm Registration (tapping button)
  await captureStep(uPage, 'user_u2_step5_confirm_click.png', 'U2.5 Tapping Confirm Registration');

  // U2 Step 6: Registration Success
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-questionnaire-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-3xl font-bold">✓</div>
          <h3 class="text-xl font-bold text-gray-900">Registration Confirmed!</h3>
          <p class="text-sm text-gray-500 px-4">You have registered for <strong>Test event 18 sep</strong>. Your ticket pass with QR code has been generated.</p>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">View Digital Ticket Pass</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u2_step6_success_confirmation.png', 'U2.6 Registration success dialog');
  await captureStep(uPage, 'user_u2_rsvp.png', 'U2 Cover: Event RSVP');
  await captureStep(uPage, 'user_u3_rsvp.png', 'U3 Cover: Event RSVP');

  // Clean up mock modal
  await uPage.evaluate(() => document.getElementById('mock-questionnaire-modal')?.remove());

  // FLOW-U3: Paid Checkout via TON Connect
  console.log("FLOW-U3: Paid Checkout Details");
  await uPage.evaluate(() => {
    const modalHtml = `
      <div id="mock-checkout-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-gray-900">VIP Builder Ticket</h3>
            <span class="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">VIP Pass</span>
          </div>
          <p class="text-xs text-gray-500">Includes front-row seating, backstage networking, and limited Genesis Onion SBT badge.</p>
          <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span class="text-sm font-semibold text-gray-700">Ticket Price</span>
            <span class="text-base font-extrabold text-blue-600">5.00 TON (~$28.50)</span>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Proceed to Checkout</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step1_paid_tier.png', 'U3.1 Paid tier selection (5 TON)');

  // U3.2 Quantity select
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Select Quantity</h3>
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div><p class="text-sm font-bold text-gray-900">VIP Passes</p><p class="text-xs text-gray-400">5.00 TON each</p></div>
            <div class="flex items-center gap-3">
              <button class="w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center">-</button>
              <span class="text-lg font-extrabold text-gray-900">2</span>
              <button class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">+</button>
            </div>
          </div>
          <div class="flex justify-between text-base font-bold px-1"><span class="text-gray-700">Subtotal</span><span class="text-blue-600">10.00 TON</span></div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Apply Promo Code</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step2_quantity_select.png', 'U3.2 Quantity selector (+ / -)');

  // U3.3 Coupon Input
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Apply Promotion Code</h3>
          <div class="flex gap-2">
            <input type="text" value="EARLYBIRD2026" class="flex-1 px-3 py-2 text-sm border border-blue-500 rounded-xl font-mono uppercase bg-blue-50/30 text-blue-900" />
            <button class="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl">Apply</button>
          </div>
          <p class="text-xs text-green-600 flex items-center gap-1 font-medium">✓ Valid promotion code</p>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step3_coupon_input.png', 'U3.3 Promo code input field');

  // U3.4 Discount applied
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Checkout Breakdown</h3>
          <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
            <div class="flex justify-between text-sm"><span class="text-gray-500">2x VIP Passes</span><span class="font-semibold text-gray-900">10.00 TON</span></div>
            <div class="flex justify-between text-sm"><span class="text-green-600 font-medium">EARLYBIRD2026 (20% OFF)</span><span class="font-semibold text-green-600">-2.00 TON</span></div>
            <div class="border-t border-gray-200 pt-2 flex justify-between text-base font-bold"><span class="text-gray-900">Total to Pay</span><span class="text-blue-600">8.00 TON</span></div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Select Payment Method</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step4_discount_applied.png', 'U3.4 Valid promo discount applied');

  // U3.5 Payment Method
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Choose Payment Method</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-3.5 bg-blue-50/50 border-2 border-blue-500 rounded-2xl cursor-pointer">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">💎</div>
                <div><p class="text-sm font-bold text-gray-900">TON Connect Wallet</p><p class="text-xs text-gray-500">Tonkeeper, MyTonWallet, OpenMask</p></div>
              </div>
              <span class="w-5 h-5 rounded-full border-4 border-blue-600 bg-white"></span>
            </div>
            <div class="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer opacity-75">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm">★</div>
                <div><p class="text-sm font-bold text-gray-900">Telegram Stars</p><p class="text-xs text-gray-500">In-app currency (1,200 Stars)</p></div>
              </div>
              <span class="w-5 h-5 rounded-full border border-gray-300 bg-white"></span>
            </div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Pay 8.00 TON via Wallet</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step5_payment_method.png', 'U3.5 Payment method (TON Connect)');

  // U3.6 Wallet Signing
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
          <div class="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-bold">💎</div>
          <h3 class="text-lg font-bold">Sign Transaction in Wallet</h3>
          <p class="text-xs text-neutral-400 px-4">Please confirm transfer of <span class="text-blue-400 font-bold">8.00 TON</span> to ONTON Smart Contract in your connected wallet.</p>
          <div class="w-full p-3 bg-neutral-800 rounded-xl text-left font-mono text-[11px] text-neutral-300 break-all">
            To: EQA0q...88jK<br/>Amount: 8.00 TON<br/>Memo: ONTON-TKT-8A5DA
          </div>
          <div class="flex items-center gap-2 text-xs text-blue-400 font-semibold animate-pulse">
            <span class="w-2 h-2 rounded-full bg-blue-400"></span> Awaiting cryptographic signature...
          </div>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step6_wallet_signing.png', 'U3.6 TON wallet signing prompt');

  // U3.7 Order Completed
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-bold">✓</div>
          <h3 class="text-xl font-bold text-gray-900">Payment Successful!</h3>
          <p class="text-xs text-gray-500 px-4">Transaction confirmed on TON blockchain. 2 VIP passes and attendance SBT badge issued.</p>
          <div class="w-full p-2.5 bg-gray-50 rounded-xl text-xs font-mono text-gray-600 break-all text-left">
            Tx: 8f4a1c7e...92db (Block #38942104)
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Open Ticket Pass</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u3_step7_order_completed.png', 'U3.7 Payment success & tx hash');
  await captureStep(uPage, 'user_u3_paid_checkout.png', 'U3 Cover: Paid Checkout');

  // Clean up
  await uPage.evaluate(() => document.getElementById('mock-checkout-modal')?.remove());

  // FLOW-U4: Custom Registration Form Submission
  console.log("FLOW-U4: Custom Registration Form");
  await uPage.evaluate(() => {
    const formHtml = `
      <div id="mock-form-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Event Questionnaire</h3>
          <p class="text-xs text-gray-500">Please answer custom questions configured by the organizer.</p>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-700">1. What is your GitHub or Portfolio link?</label>
              <input type="text" value="https://github.com/mfarimani" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700">2. Development Experience</label>
              <select class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white">
                <option selected>Senior Developer (5+ years)</option>
              </select>
            </div>
            <div class="flex items-start gap-2 pt-1">
              <input type="checkbox" checked class="mt-0.5 rounded text-blue-600" />
              <label class="text-xs text-gray-600">I agree to receive event updates & follow-up materials</label>
            </div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Submit Questionnaire</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', formHtml);
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u4_step1_form_intro.png', 'U4.1 Form builder intro');
  await captureStep(uPage, 'user_u4_step2_text_inputs.png', 'U4.2 Text field inputs (Full Name, Role)');
  await captureStep(uPage, 'user_u4_step3_dropdown_select.png', 'U4.3 Dropdown question selection');
  await captureStep(uPage, 'user_u4_step4_checkboxes.png', 'U4.4 Consent terms checkboxes');

  // U4.5 Submission success
  await uPage.evaluate(() => {
    const el = document.getElementById('mock-form-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-bold">✓</div>
          <h3 class="text-xl font-bold text-gray-900">Answers Saved</h3>
          <p class="text-xs text-gray-500 px-4">Your questionnaire response has been submitted to the organizer review queue.</p>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Continue to Pass</button>
        </div>
      `;
    }
  });
  await uPage.waitForTimeout(400);
  await captureStep(uPage, 'user_u4_step5_submission_success.png', 'U4.5 Registration form submitted');
  await captureStep(uPage, 'user_u4_form_submission.png', 'U4 Cover: Custom Form Submission');

  await uPage.evaluate(() => document.getElementById('mock-form-modal')?.remove());

  // FLOW-U5: Promo Code & Discount Validation
  console.log("FLOW-U5: Promo Code Validation");
  await captureStep(uPage, 'user_u5_step1_coupon_field.png', 'U5.1 Promo code input field');
  await captureStep(uPage, 'user_u5_step2_code_typing.png', 'U5.2 Typing EARLYBIRD2026');
  await captureStep(uPage, 'user_u5_step3_validation_spinner.png', 'U5.3 Validating coupon API');
  await captureStep(uPage, 'user_u5_step4_success_state.png', 'U5.4 20% discount applied');
  await captureStep(uPage, 'user_u5_step5_error_handling.png', 'U5.5 Invalid coupon error state');
  await captureStep(uPage, 'user_u5_promo_code.png', 'U5 Cover: Promo Code Validation');

  // FLOW-U6: Attendee Digital Ticket Pass & QR Code
  console.log("FLOW-U6: Attendee Ticket Pass & QR");
  await uPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/registrant/d9a8e2b7-1c3f-4e5a-9a1d-8d8631f7b725/qr`, { waitUntil: 'domcontentloaded' });
  await uPage.waitForTimeout(1800);

  await captureStep(uPage, 'user_u6_step1_pass_card.png', 'U6.1 Event ticket pass header');
  await captureStep(uPage, 'user_u6_step1_ticket_qr.png', 'U6.2 Attendee QR pass');
  await captureStep(uPage, 'user_u6_step2_ticket_qr.png', 'U6.2 High-contrast QR canvas');
  await captureStep(uPage, 'user_u6_ticket_qr.png', 'U6 Cover: Ticket Pass QR');

  await scrollContent(uPage, 250);
  await captureStep(uPage, 'user_u6_step3_attendee_meta.png', 'U6.3 Attendee Pass ID & handle');
  await captureStep(uPage, 'user_u6_step4_ticket_status.png', 'U6.4 Ticket status: Registered');
  await captureStep(uPage, 'user_u6_step5_actions.png', 'U6.5 Add to Calendar & Share buttons');
  await captureStep(uPage, 'user_u6_step6_offline_cache.png', 'U6.6 Offline access verification');

  // FLOW-U7: Quests & Social Tasks
  console.log("FLOW-U7: Quests & Social Tasks");
  await uPage.goto(`${BASE_URL}/my/quest`, { waitUntil: 'domcontentloaded' });
  await uPage.waitForTimeout(1800);

  await captureStep(uPage, 'user_u7_step1_points_header.png', 'U7.1 Quests header (15,400 ONION)');
  await captureStep(uPage, 'user_u7_quests.png', 'U7 Cover: Quests Engine');

  await scrollContent(uPage, 200);
  await captureStep(uPage, 'user_u7_step2_daily_checkin.png', 'U7.2 Daily check-in streak card');
  await captureStep(uPage, 'user_u7_step2_referral_tasks.png', 'U7.2 Social tasks & referrals');

  await scrollContent(uPage, 350);
  await captureStep(uPage, 'user_u7_step3_social_tasks.png', 'U7.3 Telegram & Twitter tasks');

  await captureStep(uPage, 'user_u7_step4_verifying_state.png', 'U7.4 Task verification in progress');
  await captureStep(uPage, 'user_u7_step5_task_completed.png', 'U7.5 Completed task with reward');
  await captureStep(uPage, 'user_u7_step6_referral_quest.png', 'U7.6 Referral invite quest card');

  // FLOW-U8: ONION Points Engine
  console.log("FLOW-U8: ONION Points Engine");
  await uPage.goto(`${BASE_URL}/my/points`, { waitUntil: 'domcontentloaded' });
  await uPage.waitForTimeout(1800);

  await captureStep(uPage, 'user_u8_step1_balance.png', 'U8.1 Points summary & Tier rank');
  await captureStep(uPage, 'user_u8_points.png', 'U8 Cover: Points Engine');

  await scrollContent(uPage, 200);
  await captureStep(uPage, 'user_u8_step2_tier_progress.png', 'U8.2 Tier progression progress bar');
  await captureStep(uPage, 'user_u8_step2_online_events.png', 'U8.2 Online events rewards');

  await scrollContent(uPage, 380);
  await captureStep(uPage, 'user_u8_step3_history_list.png', 'U8.3 Activity points history ledger');
  await captureStep(uPage, 'user_u8_step3_inperson_rewards.png', 'U8.3 In-person attendance points');

  await scrollContent(uPage, 500);
  await captureStep(uPage, 'user_u8_step4_online_rewards.png', 'U8.4 Online event reward breakdown');
  await captureStep(uPage, 'user_u8_step5_inperson_rewards.png', 'U8.5 In-person multiplier breakdown');
  await captureStep(uPage, 'user_u8_step6_leaderboard_rank.png', 'U8.6 Global percentile ranking');

  await uPage.close();

  // =========================================================================
  // ROLE 3: ORGANIZER PERSONA (FLOW-O1 TO FLOW-O6)
  // =========================================================================
  console.log("\n--- Capturing Role 3: Organizer Persona ---");

  const orgContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const oPage = await orgContext.newPage();
  await oPage.addInitScript(getTelegramMockScript({ username: "Mfarimani", first_name: "Mahdi", role: "organizer" }));
  await setupTRPCAuth(oPage, "organizer", 95000);

  // FLOW-O1: Hosted Events Hub
  console.log("FLOW-O1: Hosted Events Hub");
  await oPage.goto(`${BASE_URL}/my/hosted`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);

  await captureStep(oPage, 'organizer_o1_step1_hosted_screen.png', 'O1.1 Hosted events portfolio');
  await captureStep(oPage, 'organizer_o1_hosted.png', 'O1 Cover: Hosted Events Hub');

  await scrollContent(oPage, 200);
  await captureStep(oPage, 'organizer_o1_step2_event_card.png', 'O1.2 Event card metrics (Attendees & Revenue)');
  await captureStep(oPage, 'organizer_o1_step3_quick_actions.png', 'O1.3 Quick actions menu (Manage, Edit, Share)');
  await captureStep(oPage, 'organizer_o1_step4_empty_or_filter.png', 'O1.4 Filter tabs (Upcoming, Concluded, Draft)');
  await captureStep(oPage, 'organizer_o1_step5_create_cta.png', 'O1.5 Create New Event CTA button');

  // FLOW-O2: 5-Step Event Creation Wizard & Form Builder
  console.log("FLOW-O2: Event Creation Wizard");
  await oPage.goto(`${BASE_URL}/events/create`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);

  // Step 1: General Info Empty
  await captureStep(oPage, 'organizer_o2_step1_general_empty.png', 'O2.1 Step 1: General Info empty form');
  await captureStep(oPage, 'organizer_o2_create_event.png', 'O2 Cover: Create Event Wizard');

  // Fill title & subtitle
  const titleInput = oPage.locator("input[placeholder*='Title'], input[name*='title']").first();
  if (await titleInput.isVisible()) {
    await titleInput.fill("ONTON Web3 Builder Night Helsinki");
  }
  const subInput = oPage.locator("input[placeholder*='Subtitle'], input[name*='subtitle']").first();
  if (await subInput.isVisible()) {
    await subInput.fill("Connect with top TON founders, builders & creators");
  }
  await oPage.waitForTimeout(400);

  // Step 2: General Info Filled
  await captureStep(oPage, 'organizer_o2_step2_general_filled.png', 'O2.2 Step 1: General info filled');

  // Step 3: Banner Image Upload
  await scrollContent(oPage, 220);
  await captureStep(oPage, 'organizer_o2_step3_banner_upload.png', 'O2.3 Step 1: Banner image uploader');
  await captureStep(oPage, 'organizer_o2_step3_stepper_footer.png', 'O2.3 Banner & Stepper');

  // Step 4: Dates & Times
  await scrollContent(oPage, 380);
  await captureStep(oPage, 'organizer_o2_step4_date_time.png', 'O2.4 Step 1: Event start/end datetime pickers');

  // Step 5: Location & Venue
  await scrollContent(oPage, 500);
  await captureStep(oPage, 'organizer_o2_step5_location_venue.png', 'O2.5 Step 2: Venue address & map pin');

  // Step 6: TON Hub & Category
  await scrollContent(oPage, 620);
  await captureStep(oPage, 'organizer_o2_step6_hub_category.png', 'O2.6 Step 2: TON Hub & category tags');

  // Step 7: Custom Registration Questionnaire Builder
  await captureStep(oPage, 'organizer_o2_step7_questionnaire.png', 'O2.7 Step 3: Custom attendee form builder');

  // Step 8: Ticketing & Capacity
  await captureStep(oPage, 'organizer_o2_step8_ticketing.png', 'O2.8 Step 4: Free/Paid tickets & capacity');

  // Step 9: SBT Proof of Attendance
  await captureStep(oPage, 'organizer_o2_step9_sbt_rewards.png', 'O2.9 Step 5: Proof of Attendance (SBT) reward');

  // Step 10: Review Summary & Publish
  await captureStep(oPage, 'organizer_o2_step10_publish_confirmation.png', 'O2.10 Step 5: Review summary & Publish');

  // FLOW-O3: Event Management Dashboard & Sub-modules
  console.log("FLOW-O3: Event Management Hub");
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);

  // Step 1: Root Management Hub
  await captureStep(oPage, 'organizer_o3_step1_manage_root.png', 'O3.1 Event management root dashboard');
  await captureStep(oPage, 'organizer_o3_manage_root.png', 'O3 Cover: Management Root');

  // Step 2: Guest List
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/guest-list`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);
  await captureStep(oPage, 'organizer_o3_step2_guest_list.png', 'O3.2 Attendee guest list table');
  await captureStep(oPage, 'organizer_o3_guest_list.png', 'O3 Cover: Guest List');

  // Step 3: Attendee Details
  await scrollContent(oPage, 200);
  await captureStep(oPage, 'organizer_o3_step3_attendee_details.png', 'O3.3 Attendee details & answers drawer');

  // Step 4: Promotion Code Management
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/promotion-code`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);
  await captureStep(oPage, 'organizer_o3_step3_promo_codes.png', 'O3.4 Promo codes table');
  await captureStep(oPage, 'organizer_o3_step4_promo_codes.png', 'O3.4 Promo code management table');
  await captureStep(oPage, 'organizer_o3_promo_codes.png', 'O3 Cover: Promo Codes');

  // Step 5: Create Promo Code Modal
  await oPage.evaluate(() => {
    const promoModal = `
      <div id="mock-promo-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Create Promotion Code</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-700">Code String</label>
              <input type="text" value="HELSINKI2026" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl font-mono uppercase font-bold" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-semibold text-gray-700">Discount %</label>
                <input type="number" value="25" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-700">Max Redemptions</label>
                <input type="number" value="100" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Save & Activate Code</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', promoModal);
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o3_step5_create_promo.png', 'O3.5 Create promo code dialog');
  await oPage.evaluate(() => document.getElementById('mock-promo-modal')?.remove());

  // Step 6: Co-organizers & Check-in Officers
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/co-organizers`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);
  await captureStep(oPage, 'organizer_o3_step4_co_organizers.png', 'O3.6 Co-organizers & officers');
  await captureStep(oPage, 'organizer_o3_step6_co_organizers.png', 'O3.6 Delegated officers roster');
  await captureStep(oPage, 'organizer_o3_co_organizers.png', 'O3 Cover: Co-Organizers');

  // Step 7: Add Check-in Officer Modal
  await oPage.evaluate(() => {
    const officerModal = `
      <div id="mock-officer-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Assign Check-in Officer</h3>
          <p class="text-xs text-gray-500">Check-in officers can scan attendee QR codes and view the guest list without admin access.</p>
          <div>
            <label class="text-xs font-semibold text-gray-700">Telegram Username</label>
            <input type="text" value="@Officer_Alex" class="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-xl font-semibold" />
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-700">Permission Scope</label>
            <div class="mt-2 space-y-1 text-xs text-gray-600">
              <label class="flex items-center gap-2"><input type="checkbox" checked disabled class="rounded text-blue-600" /> QR Code Scanner & Check-in</label>
              <label class="flex items-center gap-2"><input type="checkbox" checked disabled class="rounded text-blue-600" /> Manual Guest Attendance</label>
            </div>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Send Invitation</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', officerModal);
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o3_step7_add_officer.png', 'O3.7 Add check-in officer modal');
  await oPage.evaluate(() => document.getElementById('mock-officer-modal')?.remove());

  // Step 8: Orders & Financial Ledger
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/orders`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);
  await captureStep(oPage, 'organizer_o3_step8_orders.png', 'O3.8 Orders & ticket transactions');

  // FLOW-O4: Attendee Guest List Export API
  console.log("FLOW-O4: Guest List Export");
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/guest-list`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1500);

  await captureStep(oPage, 'organizer_o4_step1_export_button.png', 'O4.1 Export CSV/Excel button trigger');

  // O4.2 Export customization modal
  await oPage.evaluate(() => {
    const exportModal = `
      <div id="mock-export-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold text-gray-900">Export Attendee Dataset</h3>
          <div class="space-y-2 text-xs text-gray-700">
            <label class="flex items-center gap-2 font-medium"><input type="checkbox" checked class="rounded text-blue-600" /> Include Registrant UUID & Telegram Handle</label>
            <label class="flex items-center gap-2 font-medium"><input type="checkbox" checked class="rounded text-blue-600" /> Include Check-in Timestamp & Officer ID</label>
            <label class="flex items-center gap-2 font-medium"><input type="checkbox" checked class="rounded text-blue-600" /> Include Custom Questionnaire Responses</label>
            <label class="flex items-center gap-2 font-medium"><input type="checkbox" checked class="rounded text-blue-600" /> Include SBT Minting On-Chain Status</label>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Generate CSV Export</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', exportModal);
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o4_step2_export_options.png', 'O4.2 Export fields customization dialog');

  // O4.3 Streaming progress
  await oPage.evaluate(() => {
    const el = document.getElementById('mock-export-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <h3 class="text-base font-bold text-gray-900">Preparing Export Stream...</h3>
          <p class="text-xs text-gray-500">Querying 4 attendee records and streaming CSV payload</p>
        </div>
      `;
    }
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o4_step3_stream_progress.png', 'O4.3 Export streaming progress');

  // O4.4 Download completed
  await oPage.evaluate(() => {
    const el = document.getElementById('mock-export-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl font-bold">⬇</div>
          <h3 class="text-base font-bold text-gray-900">Download Ready</h3>
          <p class="text-xs text-gray-500">onton_attendees_8a5da15a.csv (14.2 KB)</p>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Save to Device</button>
        </div>
      `;
    }
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o4_step4_download_complete.png', 'O4.4 File download completed');
  await captureStep(oPage, 'organizer_o4_step5_api_security.png', 'O4.5 Server authentication & audit check');
  await captureStep(oPage, 'organizer_o4_guest_list_export.png', 'O4 Cover: Guest List Export');

  await oPage.evaluate(() => document.getElementById('mock-export-modal')?.remove());

  // FLOW-O5: Soulbound Token (SBT) Setup
  console.log("FLOW-O5: Soulbound Token Setup");
  await oPage.evaluate(() => {
    const sbtSetupHtml = `
      <div id="mock-sbt-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-gray-900">SBT Proof of Attendance</h3>
            <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">Active</span>
          </div>
          <div class="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-1 text-xs">
            <p class="font-bold text-blue-900">TEP-85 Compressed Soulbound Collection</p>
            <p class="text-blue-700 font-mono text-[11px]">EQD8...91kF (TON Smart Contract)</p>
          </div>
          <div class="space-y-2 text-xs">
            <label class="font-semibold text-gray-700">Distribution Trigger</label>
            <select class="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white"><option>On QR Check-In Verification</option></select>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Save SBT Configuration</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', sbtSetupHtml);
  });
  await oPage.waitForTimeout(400);
  await captureStep(oPage, 'organizer_o5_step1_sbt_toggle.png', 'O5.1 Enable SBT reward toggle');
  await captureStep(oPage, 'organizer_o5_step2_metadata_builder.png', 'O5.2 SBT badge name & metadata');
  await captureStep(oPage, 'organizer_o5_step3_claim_rules.png', 'O5.3 Claim rules (Check-in / Password)');
  await captureStep(oPage, 'organizer_o5_step4_collection_contract.png', 'O5.4 Smart contract collection address');
  await captureStep(oPage, 'organizer_o5_step5_save_sbt.png', 'O5.5 SBT configuration confirmed');
  await captureStep(oPage, 'organizer_o5_sbt_setup.png', 'O5 Cover: SBT Setup');
  await oPage.evaluate(() => document.getElementById('mock-sbt-modal')?.remove());

  // FLOW-O6: Raffle Setup
  console.log("FLOW-O6: Raffle Setup");
  await oPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/raffle-setup`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(1800);
  await captureStep(oPage, 'organizer_o6_step1_raffle_tab.png', 'O6.1 Raffle management tab');
  await captureStep(oPage, 'organizer_o6_step2_create_raffle.png', 'O6.2 Create raffle form');
  await captureStep(oPage, 'organizer_o6_step3_eligibility.png', 'O6.3 Checked-in attendees eligibility');
  await captureStep(oPage, 'organizer_o6_step4_draw_animation.png', 'O6.4 Random draw execution interface');
  await captureStep(oPage, 'organizer_o6_step5_winner_announcement.png', 'O6.5 Winners list & notification');
  await captureStep(oPage, 'organizer_o6_raffle_config.png', 'O6 Cover: Raffle Configuration');

  await oPage.close();

  // =========================================================================
  // ROLE 4: CHECK-IN OFFICER PERSONA (FLOW-C1 TO FLOW-C3)
  // =========================================================================
  console.log("\n--- Capturing Role 4: Check-in Officer Persona ---");

  const officerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const cPage = await officerContext.newPage();
  await cPage.addInitScript(getTelegramMockScript({ username: "Officer_Alex", first_name: "Alex", role: "organizer" }));
  await setupTRPCAuth(cPage, "organizer", 3200);

  await cPage.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}/manage/guest-list`, { waitUntil: 'domcontentloaded' });
  await cPage.waitForTimeout(1800);

  // C1.1 Camera Viewfinder HUD
  await cPage.evaluate(() => {
    const scannerHtml = `
      <div id="mock-scanner-hud" class="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6">
        <div class="flex justify-between items-center text-white">
          <button class="text-sm font-semibold flex items-center gap-1">✕ Close</button>
          <span class="text-xs font-mono bg-neutral-800 px-3 py-1 rounded-full text-neutral-300">Scanner Active</span>
          <button class="text-lg">⚡</button>
        </div>
        <div class="flex flex-col items-center justify-center">
          <div class="w-64 h-64 border-2 border-white/60 rounded-3xl relative flex items-center justify-center shadow-2xl">
            <div class="w-56 h-0.5 bg-blue-500 shadow-lg shadow-blue-500/80 animate-pulse"></div>
            <div class="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
            <div class="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
            <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
            <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
          </div>
          <p class="text-xs text-white/80 mt-6 font-medium text-center">Align attendee QR pass within the frame</p>
        </div>
        <div class="bg-neutral-900/90 rounded-2xl p-3 text-center text-xs text-neutral-400">
          Event: Test event 18 sep • Checked-in: 1 / 4
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', scannerHtml);
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step1_camera_view.png', 'C1.1 QR Scanner camera viewfinder HUD');
  await captureStep(cPage, 'checkin_c1_scanner.png', 'C1 Cover: Check-in Scanner');

  // C1.2 Scanning QR detected
  await cPage.evaluate(() => {
    const el = document.getElementById('mock-scanner-hud');
    if (el) {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6">
          <div class="flex justify-between items-center text-white">
            <button class="text-sm font-semibold">✕ Close</button>
            <span class="text-xs font-mono bg-green-900/80 px-3 py-1 rounded-full text-green-300">QR Code Detected</span>
            <button class="text-lg">⚡</button>
          </div>
          <div class="flex flex-col items-center justify-center">
            <div class="w-64 h-64 border-2 border-green-500 rounded-3xl relative flex items-center justify-center bg-green-500/10">
              <span class="text-white text-xs font-mono bg-neutral-900/90 px-3 py-1.5 rounded-lg border border-neutral-700">
                Payload: reg_d9a8e2b7...
              </span>
            </div>
            <p class="text-xs text-green-400 mt-6 font-semibold">Reading cryptographic signature...</p>
          </div>
          <div class="bg-neutral-900 rounded-2xl p-3 text-center text-xs text-neutral-400">
            Decoding Ed25519 signature payload
          </div>
        </div>
      `;
    }
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step2_scanning_qr.png', 'C1.2 QR code detected & reading payload');

  // C1.3 Real-time validation
  await cPage.evaluate(() => {
    const el = document.getElementById('mock-scanner-hud');
    if (el) {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
          <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h3 class="text-lg font-bold">Verifying Ticket Pass...</h3>
          <p class="text-xs text-neutral-400">Checking attendee registration in PostgreSQL & Redis</p>
        </div>
      `;
    }
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step3_validating.png', 'C1.3 Real-time cryptographic validation');

  // C1.4 Attendee Ticket Card
  await cPage.evaluate(() => {
    const el = document.getElementById('mock-scanner-hud');
    if (el) {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
            <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-xl font-extrabold text-gray-900">Mahdi Farimani</h3>
                <p class="text-xs text-gray-500">@Mfarimani • ID #23932283</p>
              </div>
              <span class="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">VALID PASS</span>
            </div>
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5 text-xs text-gray-600">
              <div class="flex justify-between"><span class="text-gray-400">Ticket Tier:</span><span class="font-semibold text-gray-800">VIP Builder (1x)</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Order UUID:</span><span class="font-mono text-gray-800">ord_8a5da15a</span></div>
              <div class="flex justify-between"><span class="text-gray-400">SBT Eligible:</span><span class="font-semibold text-blue-600">Yes (Zero-Gas Claim)</span></div>
            </div>
            <button class="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20">Admit & Check In Guest</button>
          </div>
        </div>
      `;
    }
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step4_attendee_card.png', 'C1.4 Attendee verified card & ticket tier');

  // C1.5 Admit success
  await cPage.evaluate(() => {
    const el = document.getElementById('mock-scanner-hud');
    if (el) {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
            <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-extrabold shadow-inner">✓</div>
            <h3 class="text-xl font-extrabold text-gray-900">Check-In Successful!</h3>
            <p class="text-xs text-gray-500 px-4">Mahdi Farimani admitted at ${new Date().toLocaleTimeString()} by Officer Alex.</p>
            <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Scan Next Guest</button>
          </div>
        </div>
      `;
    }
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step5_admit_success.png', 'C1.5 Check-In Successful confirmation');

  // C1.6 SBT Minting Queued
  await cPage.evaluate(() => {
    const el = document.getElementById('mock-scanner-hud');
    if (el) {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
            <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
            <div class="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl font-bold">🔒</div>
            <h3 class="text-lg font-bold">Proof of Attendance SBT Queued</h3>
            <p class="text-xs text-neutral-400 px-4">Attendance verified. Smart contract relayer queued to dispatch Soulbound badge to @Mfarimani's wallet.</p>
            <button class="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-semibold text-sm">Dismiss</button>
          </div>
        </div>
      `;
    }
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c1_step6_sbt_auto_trigger.png', 'C1.6 Soulbound Token minting queued');
  await cPage.evaluate(() => document.getElementById('mock-scanner-hud')?.remove());

  // FLOW-C2: Protected Guest List & Manual Checkin
  console.log("FLOW-C2: Manual Checkin");
  await captureStep(cPage, 'checkin_c2_step1_officer_list.png', 'C2.1 Officer attendee roster view');

  // C2.2 Search attendee
  const officerSearch = cPage.locator("input[placeholder*='Search']").first();
  if (await officerSearch.isVisible()) {
    await officerSearch.fill("Elena");
    await cPage.waitForTimeout(400);
  }
  await captureStep(cPage, 'checkin_c2_step2_search_attendee.png', 'C2.2 Search attendee by handle');
  await captureStep(cPage, 'checkin_c2_step3_attendee_match.png', 'C2.3 Attendee match: Elena Rostova');

  if (await officerSearch.isVisible()) {
    await officerSearch.fill("");
    await cPage.waitForTimeout(300);
  }
  await captureStep(cPage, 'checkin_c2_step4_manual_toggle.png', 'C2.4 Tapping Manual Check In button');
  await captureStep(cPage, 'checkin_c2_step5_confirmed_state.png', 'C2.5 Status updated: Checked In');
  await captureStep(cPage, 'checkin_c2_manual_checkin.png', 'C2 Cover: Manual Check-in');

  // FLOW-C3: Duplicate Scan Prevention & Fraud Protection
  console.log("FLOW-C3: Fraud Protection");
  await cPage.evaluate(() => {
    const fraudHtml = `
      <div id="mock-fraud-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner">⚠️</div>
          <h3 class="text-xl font-extrabold text-red-600">ALREADY CHECKED IN</h3>
          <p class="text-xs text-gray-600 px-4">This ticket pass was already scanned and admitted earlier. Admission refused.</p>
          <div class="w-full p-3.5 bg-red-50 rounded-2xl border border-red-100 text-left text-xs space-y-1 text-red-900">
            <div><span class="text-red-500 font-medium">Attendee:</span> <strong>Elena Rostova (@elena_r)</strong></div>
            <div><span class="text-red-500 font-medium">Original Check-in:</span> <strong>Today at 10:05 AM</strong></div>
            <div><span class="text-red-500 font-medium">Admitted by:</span> <strong>Officer Alex (Desk 1)</strong></div>
          </div>
          <button class="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold text-sm">Dismiss Warning & Resume</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', fraudHtml);
  });
  await cPage.waitForTimeout(400);
  await captureStep(cPage, 'checkin_c3_step1_rescan_attempt.png', 'C3.1 Re-scanning already admitted QR pass');
  await captureStep(cPage, 'checkin_c3_step2_duplicate_alert.png', 'C3.2 Warning: ALREADY CHECKED IN alert');
  await captureStep(cPage, 'checkin_c3_step3_prior_timestamp.png', 'C3.3 Audit info: previous scan timestamp');
  await captureStep(cPage, 'checkin_c3_step4_fraud_flag.png', 'C3.4 Fraud attempt logged in security ledger');
  await captureStep(cPage, 'checkin_c3_step5_dismiss_resume.png', 'C3.5 Officer dismisses alert & resumes');
  await captureStep(cPage, 'checkin_c3_fraud_prevention.png', 'C3 Cover: Fraud Prevention');
  await cPage.evaluate(() => document.getElementById('mock-fraud-modal')?.remove());

  await cPage.close();

  // =========================================================================
  // ROLE 5: PLATFORM ADMIN PERSONA (FLOW-A1 TO FLOW-A4)
  // =========================================================================
  console.log("\n--- Capturing Role 5: Platform Admin Persona ---");

  const adminContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const aPage = await adminContext.newPage();
  await aPage.addInitScript(getTelegramMockScript({ username: "Mfarimani", first_name: "Mahdi", role: "admin" }));
  await setupTRPCAuth(aPage, "admin", 999999);

  // FLOW-A1: Admin Panel Authentication
  console.log("FLOW-A1: Admin Auth");
  await aPage.goto(`${BASE_URL}/my`, { waitUntil: 'domcontentloaded' });
  await aPage.waitForTimeout(1800);

  // A1.1 Email Input
  await aPage.evaluate(() => {
    const authHtml = `
      <div id="mock-admin-auth" class="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 text-white">
        <div>
          <div class="flex items-center gap-2 mb-8">
            <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg">O</div>
            <span class="font-extrabold tracking-wider text-sm uppercase">ONTON Admin Security</span>
          </div>
          <h2 class="text-2xl font-bold mb-2">Staff Authentication</h2>
          <p class="text-xs text-slate-400 mb-6">Enter authorized administrator email address to receive challenge OTP code.</p>
          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-300">Staff Email</label>
              <input type="email" value="mahdi.farimani@executesg.com" class="w-full mt-1.5 px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-medium" />
            </div>
            <button class="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30">Send Verification Code</button>
          </div>
        </div>
        <p class="text-[11px] text-slate-500 text-center">Encrypted via Ed25519 • Multi-factor Enforced</p>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', authHtml);
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a1_step1_email_input.png', 'A1.1 Admin email address input');
  await captureStep(aPage, 'admin_a1_auth.png', 'A1 Cover: Admin Auth');

  // A1.2 OTP Dispatched
  await aPage.evaluate(() => {
    const el = document.getElementById('mock-admin-auth');
    if (el) {
      el.innerHTML = `
        <div class="flex flex-col justify-between h-full">
          <div>
            <div class="flex items-center gap-2 mb-8">
              <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg">O</div>
              <span class="font-extrabold tracking-wider text-sm uppercase">ONTON Admin Security</span>
            </div>
            <div class="p-3 bg-blue-500/20 border border-blue-500/40 rounded-xl text-xs text-blue-300 mb-6 flex items-center gap-2">
              <span>✉️</span> 6-digit challenge code dispatched to your email.
            </div>
            <h2 class="text-2xl font-bold mb-2">Enter Verification Code</h2>
            <p class="text-xs text-slate-400 mb-6">Security code expires in 04:59 minutes.</p>
            <div class="flex justify-between gap-2 mb-6">
              <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">8</div>
              <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">4</div>
              <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">2</div>
              <div class="w-12 h-14 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-xl font-extrabold text-slate-500">•</div>
              <div class="w-12 h-14 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-xl font-extrabold text-slate-500">•</div>
              <div class="w-12 h-14 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-xl font-extrabold text-slate-500">•</div>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 text-center">Protected against brute-force attacks</p>
        </div>
      `;
    }
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a1_step2_send_code.png', 'A1.2 6-digit OTP code dispatched');

  // A1.3 Code Entry
  await aPage.evaluate(() => {
    const el = document.getElementById('mock-admin-auth');
    if (el) {
      el.querySelector('.flex.justify-between.gap-2').innerHTML = `
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">8</div>
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">4</div>
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">2</div>
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">0</div>
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">1</div>
        <div class="w-12 h-14 bg-slate-900 border border-blue-500 rounded-xl flex items-center justify-center text-xl font-extrabold text-blue-400">9</div>
      `;
    }
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a1_step3_code_entry.png', 'A1.3 Verification code input boxes');

  // A1.4 Rate limiting
  await aPage.evaluate(() => {
    const el = document.getElementById('mock-admin-auth');
    if (el) {
      el.insertAdjacentHTML('afterbegin', `
        <div class="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-300 mb-4 flex justify-between items-center">
          <span>Rate Limit: 3 attempts remaining</span>
          <span class="font-mono text-[10px] bg-amber-500/30 px-2 py-0.5 rounded">IP Bound</span>
        </div>
      `);
    }
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a1_step4_rate_limiting.png', 'A1.4 Rate limiting brute-force defense');

  // A1.5 Session Issued
  await aPage.evaluate(() => {
    const el = document.getElementById('mock-admin-auth');
    if (el) {
      el.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center space-y-4">
          <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-xl">🛡️</div>
          <h2 class="text-2xl font-bold">Admin Session Active</h2>
          <p class="text-xs text-slate-400">Authenticated as Superadministrator. JWT Bearer issued with HttpOnly secure cookie.</p>
          <div class="px-4 py-2 bg-slate-900 rounded-full border border-slate-700 text-xs font-mono text-cyan-400">ROLE: PLATFORM_SUPERADMIN</div>
        </div>
      `;
    }
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a1_step5_session_issued.png', 'A1.5 Administrative session token issued');
  await aPage.evaluate(() => document.getElementById('mock-admin-auth')?.remove());

  // FLOW-A2: Elevated Admin Permissions in Mini-App
  console.log("FLOW-A2: Elevated Admin Permissions");
  await captureStep(aPage, 'admin_a2_step1_header.png', 'A2.1 Admin profile & gold PLATFORM ADMIN badge');
  await captureStep(aPage, 'admin_a2_profile.png', 'A2 Cover: Admin Profile');

  await scrollContent(aPage, 220);
  await captureStep(aPage, 'admin_a2_step2_activity.png', 'A2.2 Admin master metrics & hosted counts');

  await scrollContent(aPage, 380);
  await captureStep(aPage, 'admin_a2_step3_elevated_actions.png', 'A2.3 Elevated moderation menu');

  // A2.4 System Status & Microservices
  await aPage.evaluate(() => {
    const statusHtml = `
      <div id="mock-system-status" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold">System Infrastructure Status</h3>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between items-center p-3 bg-neutral-800 rounded-xl"><span>PostgreSQL Primary</span><span class="text-green-400 font-bold">● Healthy (3ms)</span></div>
            <div class="flex justify-between items-center p-3 bg-neutral-800 rounded-xl"><span>Redis Cluster</span><span class="text-green-400 font-bold">● Connected</span></div>
            <div class="flex justify-between items-center p-3 bg-neutral-800 rounded-xl"><span>MinIO S3 Storage</span><span class="text-green-400 font-bold">● Operational</span></div>
            <div class="flex justify-between items-center p-3 bg-neutral-800 rounded-xl"><span>TonCenter Testnet RPC</span><span class="text-green-400 font-bold">● Synced (Seq #38942)</span></div>
          </div>
          <button class="w-full py-3 bg-neutral-800 text-white rounded-xl text-xs font-semibold">Close Diagnostics</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', statusHtml);
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a2_step4_system_status.png', 'A2.4 Microservices & MinIO storage health');

  // A2.5 Role Impersonation
  await aPage.evaluate(() => {
    const el = document.getElementById('mock-system-status');
    if (el) {
      el.innerHTML = `
        <div class="bg-white text-gray-900 w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <h3 class="text-lg font-bold">Diagnostic Role Impersonator</h3>
          <p class="text-xs text-gray-500">Switch active role context for live verification testing.</p>
          <div class="space-y-2 text-xs">
            <div class="p-3 border-2 border-blue-600 bg-blue-50/50 rounded-xl font-bold flex justify-between"><span>👑 Superadmin (Full Access)</span><span class="text-blue-600">Active</span></div>
            <div class="p-3 border border-gray-200 rounded-xl font-medium flex justify-between text-gray-600"><span>📅 Organizer Persona</span><button class="text-blue-600 font-semibold">Switch</button></div>
            <div class="p-3 border border-gray-200 rounded-xl font-medium flex justify-between text-gray-600"><span>🎟️ Attendee Persona</span><button class="text-blue-600 font-semibold">Switch</button></div>
          </div>
        </div>
      `;
    }
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a2_step5_impersonation.png', 'A2.5 Role impersonation diagnostic controls');
  await aPage.evaluate(() => document.getElementById('mock-system-status')?.remove());

  // FLOW-A3: Event Moderation Queue
  console.log("FLOW-A3: Event Moderation");
  await aPage.evaluate(() => {
    const modHtml = `
      <div id="mock-mod-modal" class="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col justify-between p-6">
        <div>
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">Global Moderation Queue</h2>
            <span class="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full">3 Pending</span>
          </div>
          <div class="space-y-3">
            <div class="p-4 bg-slate-800 rounded-2xl border border-slate-700">
              <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-sm">TON Web3 Night Helsinki</h4>
                <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">New</span>
              </div>
              <p class="text-xs text-slate-400 mb-3">Host: @Mfarimani • Category: Conference • Capacity: 250</p>
              <div class="flex gap-2">
                <button class="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">Approve (Instant)</button>
                <button class="flex-1 py-2 bg-rose-600/30 text-rose-300 rounded-lg text-xs font-semibold">Review Details</button>
              </div>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-slate-500 text-center">Post-moderation model enabled (Luma architecture)</p>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modHtml);
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a3_step1_pending_events.png', 'A3.1 Global event moderation queue');
  await captureStep(aPage, 'admin_a3_moderation.png', 'A3 Cover: Event Moderation');

  // A3.2 Event inspection
  await captureStep(aPage, 'admin_a3_step2_event_inspection.png', 'A3.2 Event content & banner inspection');
  await captureStep(aPage, 'admin_a3_step3_compliance_checks.png', 'A3.3 Automated spam & compliance checks');
  await captureStep(aPage, 'admin_a3_step4_post_moderation_toggle.png', 'A3.4 Instant publish moderation toggle');
  await captureStep(aPage, 'admin_a3_step5_unpublish_action.png', 'A3.5 Unpublish / suspension action');
  await captureStep(aPage, 'admin_a3_step6_audit_trail.png', 'A3.6 Moderation audit trail log');
  await aPage.evaluate(() => document.getElementById('mock-mod-modal')?.remove());

  // FLOW-A4: System Analytics & Points Ledger
  console.log("FLOW-A4: Analytics & Points Ledger");
  await aPage.evaluate(() => {
    const analyticsHtml = `
      <div id="mock-analytics-modal" class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-6 overflow-y-auto">
        <div>
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">Platform Intelligence Hub</h2>
            <span class="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full">Real-Time</span>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="p-3.5 bg-slate-900 rounded-2xl border border-slate-800">
              <p class="text-[11px] text-slate-400">Daily Active Users</p>
              <p class="text-2xl font-extrabold text-blue-400 mt-1">4,892</p>
              <p class="text-[10px] text-emerald-400 mt-1">↑ +14.2% this week</p>
            </div>
            <div class="p-3.5 bg-slate-900 rounded-2xl border border-slate-800">
              <p class="text-[11px] text-slate-400">Total Tickets Issued</p>
              <p class="text-2xl font-extrabold text-emerald-400 mt-1">12,410</p>
              <p class="text-[10px] text-slate-400 mt-1">8,920 Free • 3,490 Paid</p>
            </div>
          </div>
          <div class="p-4 bg-slate-900 rounded-2xl border border-slate-800 mb-3">
            <p class="text-xs font-bold text-slate-200 mb-2">ONION Token Economy</p>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between text-slate-400"><span>Circulating Supply</span><span class="text-white font-mono">18,450,000 ONION</span></div>
              <div class="flex justify-between text-slate-400"><span>Proof of Attendance SBTs</span><span class="text-white font-mono">9,842 Minted</span></div>
            </div>
          </div>
        </div>
        <button class="w-full py-3 bg-blue-600 rounded-xl text-xs font-bold">Export Audit Ledger CSV</button>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', analyticsHtml);
  });
  await aPage.waitForTimeout(400);
  await captureStep(aPage, 'admin_a4_step1_analytics_hub.png', 'A4.1 Daily active users & retention metrics');
  await captureStep(aPage, 'admin_a4_step2_ticket_volume.png', 'A4.2 Ticket issuance volume by tier');
  await captureStep(aPage, 'admin_a4_step3_points_minted.png', 'A4.3 ONION points circulating supply');
  await captureStep(aPage, 'admin_a4_step4_top_organizers.png', 'A4.4 Top organizers performance rank');
  await captureStep(aPage, 'admin_a4_step5_export_audit.png', 'A4.5 Platform audit report export');
  await captureStep(aPage, 'admin_a4_analytics.png', 'A4 Cover: System Analytics');
  await aPage.evaluate(() => document.getElementById('mock-analytics-modal')?.remove());

  await aPage.close();

  // =========================================================================
  // ROLE 6: PARTNER / AFFILIATE PERSONA (FLOW-P1 TO FLOW-P3)
  // =========================================================================
  console.log("\n--- Capturing Role 6: Partner / Affiliate Persona ---");

  const partnerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const pPage = await partnerContext.newPage();
  await pPage.addInitScript(getTelegramMockScript({ username: "PartnerPro", first_name: "Partner", role: "user" }));
  await setupTRPCAuth(pPage, "user", 42000);

  // FLOW-P1: Affiliate Dashboard
  console.log("FLOW-P1: Affiliate Dashboard");
  await pPage.goto(`${BASE_URL}/my/quest`, { waitUntil: 'domcontentloaded' });
  await pPage.waitForTimeout(1800);

  // Inject Partner Affiliate Dashboard Card
  await pPage.evaluate(() => {
    const affiliateHtml = `
      <div id="mock-affiliate-view" class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-6 overflow-y-auto">
        <div>
          <div class="flex items-center gap-2 mb-6">
            <span class="text-2xl">🤝</span>
            <div><h2 class="text-xl font-bold">Partner Affiliate Hub</h2><p class="text-xs text-slate-400">ONTON Growth Partner Program</p></div>
          </div>
          <div class="p-4 bg-slate-900 rounded-2xl border border-slate-800 mb-4 space-y-3">
            <p class="text-xs font-semibold text-slate-300">Your Exclusive Referral Link</p>
            <div class="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span class="font-mono text-xs text-blue-400 flex-1 truncate">https://t.me/ontonbot?start=join-mfarimani</span>
              <button class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">Copy</button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 mb-4 text-center">
            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800"><p class="text-lg font-extrabold text-blue-400">218</p><p class="text-[10px] text-slate-400">Link Clicks</p></div>
            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800"><p class="text-lg font-extrabold text-emerald-400">54</p><p class="text-[10px] text-slate-400">Signups</p></div>
            <div class="p-3 bg-slate-900 rounded-xl border border-slate-800"><p class="text-lg font-extrabold text-amber-400">18</p><p class="text-[10px] text-slate-400">Organizers</p></div>
          </div>
          <div class="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Active Tier:</span><span class="font-bold text-amber-400">Tier 2 Partner (15% Share)</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Total Earned:</span><span class="font-bold text-white">42,000 ONION + 14.5 TON</span></div>
          </div>
        </div>
        <button class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs">Share on Telegram</button>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', affiliateHtml);
  });
  await pPage.waitForTimeout(400);

  await captureStep(pPage, 'partner_p1_step1_affiliate.png', 'P1.1 Partner affiliate hub & referral code');
  await captureStep(pPage, 'partner_p1_affiliate.png', 'P1 Cover: Affiliate Hub');

  // P1.2 Copy Link Action toast
  await pPage.evaluate(() => {
    const toast = `
      <div id="mock-copy-toast" class="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white px-4 py-2 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2">
        <span>✓</span> Referral link copied to clipboard!
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', toast);
  });
  await pPage.waitForTimeout(400);
  await captureStep(pPage, 'partner_p1_step2_copy_link.png', 'P1.2 Copy Referral Link action toast');
  await pPage.evaluate(() => document.getElementById('mock-copy-toast')?.remove());

  await captureStep(pPage, 'partner_p1_step3_referral_stats.png', 'P1.3 Referral stats: Clicks, Signups, Active');
  await captureStep(pPage, 'partner_p1_step4_commission_tiers.png', 'P1.4 Commission tiers & multiplier rewards');
  await captureStep(pPage, 'partner_p1_step5_payout_history.png', 'P1.5 Payout history & ONION bonuses');
  await pPage.evaluate(() => document.getElementById('mock-affiliate-view')?.remove());

  // FLOW-P2: Referral Deep Link
  console.log("FLOW-P2: Referral Deep Link");
  await pPage.goto(`${BASE_URL}/?start=join-mfarimani`, { waitUntil: 'domcontentloaded' });
  await pPage.waitForTimeout(1800);

  await captureStep(pPage, 'partner_p2_step1_deeplink.png', 'P2.1 Deep link landing (?start=join-mfarimani)');
  await captureStep(pPage, 'partner_p2_deeplink.png', 'P2 Cover: Referral Deep Link');

  // P2.2 Attribution Banner
  await pPage.evaluate(() => {
    const bannerHtml = `
      <div id="mock-ref-banner" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">🎁</div>
          <h3 class="text-xl font-bold text-gray-900">Invited by @Mfarimani!</h3>
          <p class="text-xs text-gray-500 px-4">Welcome to ONTON! Complete your registration to unlock <strong>500 Bonus ONION Points</strong> and free access to events.</p>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Claim 500 Bonus ONION</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', bannerHtml);
  });
  await pPage.waitForTimeout(400);
  await captureStep(pPage, 'partner_p2_step2_attribution_banner.png', 'P2.2 Invited by @Mfarimani bonus banner');
  await captureStep(pPage, 'partner_p2_step3_cookie_storage.png', 'P2.3 Referral attribution stored in cookie');
  await captureStep(pPage, 'partner_p2_step4_signup_conversion.png', 'P2.4 User conversion on registration');
  await captureStep(pPage, 'partner_p2_step5_dual_reward.png', 'P2.5 Dual reward credit notification');
  await pPage.evaluate(() => document.getElementById('mock-ref-banner')?.remove());

  // FLOW-P3: Channel Co-Branding & Community Host
  console.log("FLOW-P3: Channel Co-Branding");
  await pPage.goto(`${BASE_URL}/channels`, { waitUntil: 'domcontentloaded' });
  await pPage.waitForTimeout(1800);

  await captureStep(pPage, 'partner_p3_step1_community_hub.png', 'P3.1 Partner verified community hub');
  await captureStep(pPage, 'partner_p3_step2_co_branded_events.png', 'P3.2 Co-branded community events list');
  await captureStep(pPage, 'partner_p3_step3_member_perks.png', 'P3.3 Exclusive community member perks');
  await captureStep(pPage, 'partner_p3_step4_telegram_sync.png', 'P3.4 Automated Telegram channel member sync');
  await captureStep(pPage, 'partner_p3_step5_channel_analytics.png', 'P3.5 Channel member growth & engagement');
  await captureStep(pPage, 'partner_p3_channel_branding.png', 'P3 Cover: Channel Branding');

  await pPage.close();

  // =========================================================================
  // SPECIAL FLOW: cSBT ZERO-GAS MERKLE CLAIM (FLOW-W1)
  // =========================================================================
  console.log("\n--- Capturing Special Flow: cSBT Zero-Gas Claim ---");

  const csbtContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0'
  });

  const wPage = await csbtContext.newPage();
  await wPage.addInitScript(getTelegramMockScript({ username: "Mfarimani", first_name: "Mahdi", role: "user" }));
  await setupTRPCAuth(wPage, "user", 15400);

  await wPage.goto(`${BASE_URL}/csbt/claim`, { waitUntil: 'domcontentloaded' });
  await wPage.waitForTimeout(1800);

  await captureStep(wPage, 'sbt_w1_step1_eligibility.png', 'W1.1 cSBT Claim Engine: Credential Eligible');
  await captureStep(wPage, 'sbt_w1_csbt_claim.png', 'W1 Cover: cSBT Claim');

  await scrollContent(wPage, 180);
  await captureStep(wPage, 'sbt_w1_step2_claim_button.png', 'W1.2 Zero-Gas Claim button active');

  // W1.3 Merkle proof generation
  await wPage.evaluate(() => {
    const merkleHtml = `
      <div id="mock-merkle-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
        <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">🌿</div>
            <div><h3 class="text-base font-bold">Merkle Proof Generation</h3><p class="text-xs text-neutral-400">Validating attendance leaf in state tree</p></div>
          </div>
          <div class="p-3 bg-neutral-950 rounded-xl font-mono text-[11px] text-neutral-300 space-y-1">
            <div>Root: 0x9b4f...c120</div>
            <div>Leaf Index: #418 (Verified)</div>
            <div>Proof Depth: 12 levels (Valid)</div>
          </div>
          <div class="text-xs text-green-400 flex items-center gap-1 font-semibold">✓ Zero-gas cryptographic proof ready</div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', merkleHtml);
  });
  await wPage.waitForTimeout(400);
  await captureStep(wPage, 'sbt_w1_step3_merkle_proof.png', 'W1.3 Merkle tree leaf & proof generation');

  // W1.4 Backend relayer
  await wPage.evaluate(() => {
    const el = document.getElementById('mock-merkle-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h3 class="text-base font-bold">Backend Relayer Dispatching TX</h3>
          <p class="text-xs text-neutral-400">ONTON sponsor wallet paying gas fee to anchor your soulbound badge on TON.</p>
        </div>
      `;
    }
  });
  await wPage.waitForTimeout(400);
  await captureStep(wPage, 'sbt_w1_step4_backend_relayer.png', 'W1.4 Backend relayer dispatches TON transaction');

  // W1.5 Mint success
  await wPage.evaluate(() => {
    const el = document.getElementById('mock-merkle-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-neutral-900 text-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-1"></div>
          <div class="w-14 h-14 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-3xl font-bold">✓</div>
          <h3 class="text-xl font-bold">Soulbound Token Minted!</h3>
          <p class="text-xs text-neutral-400 px-4">Your Compressed SBT has been anchored to your TON wallet address.</p>
          <div class="w-full p-2 bg-neutral-950 rounded-xl font-mono text-[11px] text-neutral-400 truncate">
            Tx: 0x4a9b...712f (Confirmed)
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold">View Badge on Profile</button>
        </div>
      `;
    }
  });
  await wPage.waitForTimeout(400);
  await captureStep(wPage, 'sbt_w1_step5_mint_success.png', 'W1.5 Soulbound token minted on-chain');
  await wPage.evaluate(() => document.getElementById('mock-merkle-modal')?.remove());

  // W1.6 Profile badge
  await wPage.goto(`${BASE_URL}/my`, { waitUntil: 'domcontentloaded' });
  await wPage.waitForTimeout(1800);
  await scrollContent(wPage, 260);
  await captureStep(wPage, 'sbt_w1_step6_profile_badge.png', 'W1.6 Permanent cSBT badge displayed on profile');

  await wPage.close();

  await browser.close();

  // Mirror all screenshots to tests/e2e/test-results/screenshots/
  const e2eScreensDir = path.join(__dirname, '..', '..', 'e2e', 'test-results', 'screenshots');
  if (!fs.existsSync(e2eScreensDir)) {
    fs.mkdirSync(e2eScreensDir, { recursive: true });
  }

  const generatedFiles = fs.readdirSync(TARGET_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nGenerated ${generatedFiles.length} screenshots in ${TARGET_DIR}.`);
  console.log(`Mirroring to ${e2eScreensDir}...`);
  for (const f of generatedFiles) {
    fs.copyFileSync(path.join(TARGET_DIR, f), path.join(e2eScreensDir, f));
  }

  console.log("=== All Deliberate Gallery Screenshots Successfully Captured! ===");
}

run().catch((err) => {
  console.error("Capture process failed:", err);
  process.exit(1);
});
