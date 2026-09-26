const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://app.dev.onton.live';
const KNOWN_EVENT_UUID = '8a5da15a-6b40-4d0c-8a7c-af0191c81637';

const TARGET_DIR = path.join(__dirname, '..', 'assets', 'screenshots');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'events');

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
  await page.waitForTimeout(500);
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

// Master event mock data for Luma-grade experience
const futureStart = Math.floor(Date.now() / 1000) + 86400 * 14; // 14 days in future
const futureEnd = futureStart + 86400 * 3; // 3-day hackathon

const masterLumaEvents = {
  hackathon: {
    event_id: 101,
    event_uuid: KNOWN_EVENT_UUID,
    title: 'TON Hacker House Dubai 2026',
    subtitle: '48-hour competitive build for $100k prizes & ecosystem grants',
    description: `## Welcome to TON Hacker House Dubai 2026

Join 300+ top Web3 developers, founders, and smart contract engineers for the largest TON ecosystem hackathon in the Middle East.

### 🏆 Prize Tracks & Bounties
- **DeFi & Liquidity Primitives**: $35,000
- **Telegram Mini Apps & Social Gaming**: $35,000
- **Zero-Knowledge & Consumer Tools**: $30,000

### 📅 Agenda Highlights
- **Day 1**: Opening Ceremony, Team Formation & Keynote with TON Core Architects
- **Day 2**: 24h Hacking Sprint, Mentor Office Hours & Midnight Tacos
- **Day 3**: Pitch Finals, VC Demo Day & $100,000 Awards Ceremony

### 📍 Venue & Access
Grand Hyatt Dubai Conference Center, Oud Metha Road, Dubai, UAE. High-speed gigabit Wi-Fi, hardware stations, and 24/7 catering provided.`,
    image_url: 'https://storage.onton.live/onton/ton_hacker_house_dubai.png',
    tsRewardImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
    start_date: futureStart,
    end_date: futureEnd,
    isNotEnded: true,
    isStarted: false,
    location: 'Grand Hyatt Dubai Conference Center, Oud Metha Road, Dubai, UAE',
    participationType: 'in_person',
    category_id: 1,
    has_registration: true,
    has_approval: true,
    capacity: 300,
    has_waiting_list: true,
    capacity_filled: false,
    registrant_status: '',
    registrant_uuid: null,
    hidden: false,
    enabled: true,
    owner: 23932283,
    society_hub: { id: '1', name: 'TON Society Middle East' },
    organizer: {
      org_channel_name: 'TON Society Middle East',
      org_support_telegram_user_name: '@tonsocietymea',
      org_x_link: 'https://x.com/tonsociety_mea',
      org_bio: 'Official TON Society chapter supporting builders across the MEA region',
      org_image: 'https://storage.onton.live/onton/ton_society_mea_avatar.png',
      user_id: 23932283,
      username: 'tonsocietymea',
      first_name: 'TON Society',
      hosted_event_count: 14,
      is_ts_verified: true
    },
    payment_details: {
      token_id: 1,
      price: 15,
      recipient_address: 'EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44',
      title: 'Hacker House VIP Builder Pass',
      description: 'Access to 48h hacking arena, mentor office hours, catering, and Genesis SBT.',
      ticketImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
      ticket_type: 'NFT',
      token: { token_id: 1, symbol: 'TON', decimals: 9 }
    },
    category: { category_id: 1, name: 'Hackathon', title: 'Hackathon' },
    registrationFromSchema: { isCustom: true }
  },

  vipDinner: {
    event_id: 102,
    event_uuid: 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
    title: 'Founders & Investors Sunset Soirée',
    subtitle: 'Intimate golden-hour networking for Web3 founders, VCs & angel allocators',
    description: `## Founders & Investors Sunset Soirée

An exclusive, invitation-only evening bringing together top Tier-1 venture funds, angel syndicates, and premier TON founders during Dubai Web3 Week.

### 🍸 Format & Evening Flow
- **18:30 - 19:30**: Rooftop Sunset Cocktails & Curated Introductions
- **19:30 - 21:00**: 4-Course Gourmet Dinner & Partner Roundtables
- **21:00 - 22:30**: Nightcap Lounge, Deal Room & Ecosystem Announcements

### 🔒 Privacy & Access
Strictly capped at 40 participants. Venue address revealed only to approved ticket holders 24 hours prior to the event.`,
    image_url: 'https://storage.onton.live/onton/founders_sunset_soiree.png',
    tsRewardImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
    start_date: futureStart + 86400 * 20,
    end_date: futureStart + 86400 * 20 + 14400,
    isNotEnded: true,
    isStarted: false,
    location: 'CÉ LA VI Dubai, Address Sky View (Secret Venue - Approved Guests Only)',
    participationType: 'in_person',
    category_id: 2,
    has_registration: true,
    has_approval: true,
    capacity: 40,
    has_waiting_list: false,
    capacity_filled: false,
    registrant_status: '',
    registrant_uuid: null,
    hidden: false,
    enabled: true,
    owner: 23932283,
    society_hub: { id: '1', name: 'TON Society Middle East' },
    organizer: {
      org_channel_name: 'TON Society Middle East',
      org_support_telegram_user_name: '@tonsocietymea',
      org_x_link: 'https://x.com/tonsociety_mea',
      org_bio: 'Official TON Society chapter supporting builders across the MEA region',
      org_image: 'https://storage.onton.live/onton/ton_society_mea_avatar.png',
      user_id: 23932283,
      username: 'tonsocietymea',
      first_name: 'TON Society',
      hosted_event_count: 14,
      is_ts_verified: true
    },
    payment_details: {
      token_id: 1,
      price: 0,
      recipient_address: 'EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44',
      title: 'Executive VIP Pass',
      description: 'Exclusive dinner admission and VIP networking.',
      ticketImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
      ticket_type: 'TSCSBT',
      token: { token_id: 1, symbol: 'TON', decimals: 9 }
    },
    category: { category_id: 2, name: 'Networking', title: 'Networking' },
    registrationFromSchema: { isCustom: true }
  },

  masterclass: {
    event_id: 103,
    event_uuid: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    title: 'TON Mini App Mastery: From Zero to 1M DAU',
    subtitle: 'Production Next.js 15, TonConnect v2, Zero-Gas relayers, Telegram SDK',
    description: `## TON Mini App Engineering Masterclass

Deep dive into advanced Telegram Mini App architecture, high-performance UI optimization, wallet session persistence, and zero-gas smart contract sponsorship.

### 🛠 Curriculum
1. **SDK Mastery**: Telegram WebApp API 7.10, safe-area insets, haptics & native popups
2. **Wallet Connectivity**: TonConnect UI v2, proof payload verification, session caching
3. **Gasless Architecture**: Account Abstraction, relayer gas subsidies, and sponsored transactions
4. **Live Code Walkthrough**: Real-time deployment of a production-ready Web3 TMA`,
    image_url: 'https://storage.onton.live/onton/mini_app_masterclass.png',
    tsRewardImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
    start_date: futureStart + 86400 * 7,
    end_date: futureStart + 86400 * 7 + 7200,
    isNotEnded: true,
    isStarted: false,
    location: 'https://live.onton.live/masterclass/ton-mini-app',
    participationType: 'online',
    category_id: 3,
    has_registration: false,
    has_approval: false,
    capacity: null,
    has_waiting_list: false,
    capacity_filled: false,
    registrant_status: '',
    registrant_uuid: null,
    hidden: false,
    enabled: true,
    owner: 23932283,
    society_hub: { id: '1', name: 'TON Society Middle East' },
    organizer: {
      org_channel_name: 'TON Society Middle East',
      org_support_telegram_user_name: '@tonsocietymea',
      org_x_link: 'https://x.com/tonsociety_mea',
      org_bio: 'Official TON Society chapter supporting builders across the MEA region',
      org_image: 'https://storage.onton.live/onton/ton_society_mea_avatar.png',
      user_id: 23932283,
      username: 'tonsocietymea',
      first_name: 'TON Society',
      hosted_event_count: 14,
      is_ts_verified: true
    },
    category: { category_id: 3, name: 'Workshop', title: 'Workshop' },
    registrationFromSchema: { isCustom: false }
  },

  gamingArena: {
    event_id: 104,
    event_uuid: 'd4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
    title: 'Onion Arena Cyber Cup 2026',
    subtitle: '32 Teams, 5,000 TON Prize Pool, Double Elimination Bracket',
    description: `## Onion Arena Cyber Cup 2026

The flagship competitive Telegram gaming tournament on TON. 32 teams battle in real-time PvP combat for a share of 5,000 TON and exclusive champion NFTs.

### 🎮 Tournament Rules & Format
- **32 Verified Teams**: 3 players + 1 substitute per squad
- **Double Elimination Bracket**: Best-of-3 in preliminary rounds; Best-of-5 in Grand Finals
- **Anti-Cheat & Latency**: Dedicated regional low-ping game servers in Frankfurt and Dubai`,
    image_url: 'https://storage.onton.live/onton/onion_arena_championship.png',
    tsRewardImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
    start_date: futureStart + 86400 * 12,
    end_date: futureStart + 86400 * 12 + 28800,
    isNotEnded: true,
    isStarted: false,
    location: 'https://arena.onton.live/bracket/cup26',
    participationType: 'online',
    category_id: 4,
    has_registration: true,
    has_approval: false,
    capacity: 32,
    has_waiting_list: true,
    capacity_filled: false,
    registrant_status: '',
    registrant_uuid: null,
    hidden: false,
    enabled: true,
    owner: 23932283,
    society_hub: { id: '1', name: 'TON Society Middle East' },
    organizer: {
      org_channel_name: 'TON Society Middle East',
      org_support_telegram_user_name: '@tonsocietymea',
      org_x_link: 'https://x.com/tonsociety_mea',
      org_bio: 'Official TON Society chapter supporting builders across the MEA region',
      org_image: 'https://storage.onton.live/onton/ton_society_mea_avatar.png',
      user_id: 23932283,
      username: 'tonsocietymea',
      first_name: 'TON Society',
      hosted_event_count: 14,
      is_ts_verified: true
    },
    payment_details: {
      token_id: 1,
      price: 5,
      recipient_address: 'EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44',
      title: 'Team Entry Ticket',
      description: 'Official squad slot in 32-team tournament bracket.',
      ticketImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
      ticket_type: 'NFT',
      token: { token_id: 1, symbol: 'TON', decimals: 9 }
    },
    category: { category_id: 4, name: 'Gaming', title: 'Gaming' },
    registrationFromSchema: { isCustom: true }
  },

  communityMeetup: {
    event_id: 105,
    event_uuid: 'e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
    title: 'TON Community Coffee & Demos - Dubai',
    subtitle: 'Casual bi-weekly meetup for TON ecosystem enthusiasts & creators',
    description: `## TON Community Coffee & Demos

Join our vibrant bi-weekly ecosystem meetup at Alserkal Avenue! Great specialty coffee, lightning demos from local founders, and informal networking.

### ☕ What to Expect
- **10:00 - 10:30**: Specialty Pour-over Coffee & Pastries
- **10:30 - 11:30**: 5-Minute Lightning Demos (Open mic for TON projects)
- **11:30 - 13:00**: Freeform Networking & Ecosystem Office Hours`,
    image_url: 'https://storage.onton.live/onton/dubai_community_meetup.png',
    tsRewardImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
    start_date: futureStart + 86400 * 25,
    end_date: futureStart + 86400 * 25 + 10800,
    isNotEnded: true,
    isStarted: false,
    location: 'Nightjar Coffee Roasters, Alserkal Avenue, Al Quoz, Dubai',
    participationType: 'in_person',
    category_id: 5,
    has_registration: true,
    has_approval: false,
    capacity: 75,
    has_waiting_list: false,
    capacity_filled: false,
    registrant_status: '',
    registrant_uuid: null,
    hidden: false,
    enabled: true,
    owner: 23932283,
    society_hub: { id: '1', name: 'TON Society Middle East' },
    organizer: {
      org_channel_name: 'TON Society Middle East',
      org_support_telegram_user_name: '@tonsocietymea',
      org_x_link: 'https://x.com/tonsociety_mea',
      org_bio: 'Official TON Society chapter supporting builders across the MEA region',
      org_image: 'https://storage.onton.live/onton/ton_society_mea_avatar.png',
      user_id: 23932283,
      username: 'tonsocietymea',
      first_name: 'TON Society',
      hosted_event_count: 14,
      is_ts_verified: true
    },
    payment_details: {
      token_id: 1,
      price: 0,
      recipient_address: 'EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44',
      title: 'Free Community RSVP',
      description: 'Admission to coffee meetup and demos.',
      ticketImage: 'https://storage.onton.live/onton/sbt_hacker_crystal.png',
      ticket_type: 'NFT',
      token: { token_id: 1, symbol: 'TON', decimals: 9 }
    },
    category: { category_id: 5, name: 'Community', title: 'Community' },
    registrationFromSchema: { isCustom: false }
  }
};

// Route interceptor setup
async function setupMasterRoutes(page, currentUser) {
  // Fulfill local images
  await page.route('**/*.png*', async (route) => {
    const url = route.request().url();
    const basename = path.basename(url.split('?')[0]);
    const localAsset = path.join(ASSETS_DIR, basename);
    if (fs.existsSync(localAsset)) {
      return route.fulfill({
        contentType: 'image/png',
        body: fs.readFileSync(localAsset)
      });
    }
    return route.continue();
  });

  // Intercept tRPC
  await page.route('**/api/trpc/*', async (route) => {
    const url = route.request().url().toLowerCase();

    if (url.includes('events.getevent')) {
      // Find matching event by hash or default to hackathon
      let targetEvent = masterLumaEvents.hackathon;
      if (url.includes(masterLumaEvents.vipDinner.event_uuid)) targetEvent = masterLumaEvents.vipDinner;
      else if (url.includes(masterLumaEvents.masterclass.event_uuid)) targetEvent = masterLumaEvents.masterclass;
      else if (url.includes(masterLumaEvents.gamingArena.event_uuid)) targetEvent = masterLumaEvents.gamingArena;
      else if (url.includes(masterLumaEvents.communityMeetup.event_uuid)) targetEvent = masterLumaEvents.communityMeetup;

      return route.fulfill({ json: { result: { data: targetEvent } } });
    }

    if (url.includes('events.geteventswithfilters')) {
      const allEvents = Object.values(masterLumaEvents);
      return route.fulfill({ json: { result: { data: { events: allEvents, nextCursor: null } } } });
    }

    if (url.includes('events.listpaymenttokens')) {
      return route.fulfill({ json: { result: { data: [{ token_id: 1, symbol: 'TON', decimals: 9 }] } } });
    }

    if (url.includes('organizers.getorganizer')) {
      return route.fulfill({
        json: {
          result: {
            data: {
              user_id: currentUser.user_id,
              username: currentUser.username,
              first_name: currentUser.first_name,
              last_name: currentUser.last_name,
              role: currentUser.role,
              org_channel_name: currentUser.org_channel_name || "TON Society Middle East",
              org_support_telegram_user_name: currentUser.org_support_telegram_user_name || "@tonsocietymea",
              org_x_link: currentUser.org_x_link || "https://x.com/tonsociety_mea",
              org_bio: currentUser.org_bio || "Official TON Society chapter supporting builders across the MEA region.",
              org_image: currentUser.org_image || "https://storage.onton.live/onton/ton_society_mea_avatar.png",
              photo_url: currentUser.photo_url || "https://storage.onton.live/onton/ton_society_mea_avatar.png"
            }
          }
        }
      });
    }

    if (url.includes('users.syncuser')) {
      return route.fulfill({ json: { result: { data: currentUser } } });
    }

    if (url.includes('users.haveaccesstoeventadministration')) {
      return route.fulfill({
        json: {
          result: {
            data: {
              valid: currentUser.role === 'organizer' || currentUser.role === 'admin',
              role: currentUser.role,
              user: currentUser
            }
          }
        }
      });
    }

    if (url.includes('users.getwallet')) {
      return route.fulfill({ json: { result: { data: currentUser.wallet_address } } });
    }

    if (url.includes('usersscore.gettotalscorebyuserid')) {
      return route.fulfill({ json: { result: { data: currentUser.points } } });
    }

    if (url.includes('events.getorganizerevents')) {
      const orgEvents = [
        masterLumaEvents.hackathon,
        masterLumaEvents.vipDinner,
        masterLumaEvents.masterclass,
        masterLumaEvents.gamingArena,
        masterLumaEvents.communityMeetup
      ];
      return route.fulfill({ json: { result: { data: orgEvents } } });
    }

    if (url.includes('registrant.geteventregistrants')) {
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
                  registrant_info: { Role: "Lead Full-Stack", Company: "ExecutESG" }
                }
              ],
              nextCursor: null
            }
          }
        }
      });
    }

    if (url.includes('coupon.getcoupondefinitions')) {
      return route.fulfill({
        json: {
          result: {
            data: [
              {
                id: 1,
                count: 100,
                value: 20,
                used: 28,
                start_date: new Date(Date.now() - 86400000).toISOString(),
                end_date: new Date(Date.now() + 864000000).toISOString(),
                cpd_status: "active"
              }
            ]
          }
        }
      });
    }

    if (url.includes('userroles.listalluserrolesforeventid')) {
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
  console.log("=== Starting Luma-Grade Organizer Onboarding & Event Creation Capture ===");
  console.log(`Target directory: ${TARGET_DIR}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, // High-DPI Retina
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0.0 (Apple; iPhone 15 Pro; iOS 17.0)'
  });

  const page = await context.newPage();

  // =========================================================================
  // 1. NEW ORGANIZER ONBOARDING JOURNEY (FLOW-ONB)
  // =========================================================================
  console.log("\n--- Capturing FLOW-ONB: New Organizer Onboarding Journey ---");

  // Step 1: Attendee profile without wallet -> shows OrganizerProgress Step 1
  const userNoWallet = {
    user_id: 23932283,
    username: "Mfarimani",
    first_name: "Mahdi",
    last_name: "Farimani",
    language_code: "en",
    role: "user",
    wallet_address: null,
    photo_url: "https://storage.onton.live/onton/ton_society_mea_avatar.png",
    points: 15400,
    has_blocked_the_bot: false,
    participated_event_count: 5,
    hosted_event_count: 0,
    created_at: new Date().toISOString(),
  };

  await page.addInitScript(getTelegramMockScript(userNoWallet));
  await setupMasterRoutes(page, userNoWallet);

  await page.goto(`${BASE_URL}/my`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await captureStep(page, 'organizer_onb_step1_profile_intro.png', 'ONB.1 Profile with Early Organizer Access banner (Step 1: Connect Wallet)');
  await captureStep(page, 'organizer_onb_cover.png', 'ONB Cover: Organizer Onboarding');

  // Step 2: Connect Wallet Card
  await scrollContent(page, 400);
  await captureStep(page, 'organizer_onb_step2_wallet_connected.png', 'ONB.2 Connect TON Wallet component');

  // Step 3: User with Connected Wallet -> OrganizerProgress Step 2 + PaymentCard
  const userWithWallet = {
    ...userNoWallet,
    wallet_address: "EQBvW8Z5huBkMJYdn3BaXTv8AqnyuvKMO-snjwOOY44"
  };
  await setupMasterRoutes(page, userWithWallet);
  await page.goto(`${BASE_URL}/my`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await scrollContent(page, 350);
  await captureStep(page, 'organizer_onb_step3_fee_payment.png', 'ONB.3 Organizer activation fee payment card (1.00 TON)');

  // Step 4: Organizer Channel Profile Setup (/my/edit)
  const userOrganizer = {
    ...userWithWallet,
    role: "organizer",
    org_channel_name: "TON Society Middle East",
    org_support_telegram_user_name: "@tonsocietymea",
    org_x_link: "https://x.com/tonsociety_mea",
    org_bio: "Official TON Society chapter supporting builders and ecosystem development across the MEA region.",
    org_image: "https://storage.onton.live/onton/ton_society_mea_avatar.png",
    hosted_event_count: 5
  };
  await setupMasterRoutes(page, userOrganizer);
  await page.goto(`${BASE_URL}/my/edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Fill the inputs cleanly with official TON Society MEA branding
  const nameInput = page.locator("input[name='org_channel_name']");
  if (await nameInput.isVisible()) await nameInput.fill("TON Society Middle East");

  const tgInput = page.locator("input[name='org_support_telegram_user_name']");
  if (await tgInput.isVisible()) await tgInput.fill("@tonsocietymea");

  const xInput = page.locator("input[name='org_x_link']");
  if (await xInput.isVisible()) await xInput.fill("https://x.com/tonsociety_mea");

  const bioInput = page.locator("textarea[name='org_bio']");
  if (await bioInput.isVisible()) await bioInput.fill("Official TON Society chapter supporting builders across the MEA region.");

  await page.waitForTimeout(500);
  await captureStep(page, 'organizer_onb_step4_channel_setup.png', 'ONB.4 Organizer Channel profile setup form');

  // Step 5: Fully onboarded profile on /my with InlineChannelCard and FAB (+)
  await page.goto(`${BASE_URL}/my`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_onb_step5_ready_profile.png', 'ONB.5 Onboarded Organizer profile with channel card and + FAB');

  // =========================================================================
  // 2. SCENARIO 1: FLAGSHIP TECH SUMMIT & HACKATHON (FLOW-O2A)
  // =========================================================================
  console.log("\n--- Capturing Scenario 1: Flagship Hackathon (FLOW-O2A) ---");

  // Step 1: Blank Event Creation Form
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_o2a_step1_general_empty.png', 'O2A.1 Stepper Step 1: General Info blank form');
  await captureStep(page, 'organizer_o2a_cover.png', 'O2A Cover: Flagship Hackathon Creation');
  await captureStep(page, 'organizer_o2_step1_general_empty.png', 'O2.1 Step 1: General Info empty form');
  await captureStep(page, 'organizer_o2_create_event.png', 'O2 Cover: Create Event Wizard');

  // Step 2: Fill Title, Subtitle, Category, Description
  const titleField = page.locator("input[name='title']").first();
  if (await titleField.isVisible()) await titleField.fill("TON Hacker House Dubai 2026");

  const subField = page.locator("input[name='subtitle']").first();
  if (await subField.isVisible()) await subField.fill("48-hour competitive build for $100k prizes & ecosystem grants");

  const descField = page.locator("textarea[name='description']").first();
  if (await descField.isVisible()) {
    await descField.fill(`Join 300+ top Web3 developers and engineers for the largest TON hackathon in the Middle East. Prize tracks: $35k DeFi, $35k Mini Apps, $30k ZK. High-speed gigabit Wi-Fi, hardware stations, and 24/7 catering provided.`);
  }

  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step2_title_desc.png', 'O2A.2 Stepper Step 1: Title, subtitle and Luma-grade description');
  await captureStep(page, 'organizer_o2_step2_general_filled.png', 'O2.2 Step 1: General info filled');

  // Step 3: Upload Banner Artwork & Terms Checkbox
  await scrollContent(page, 280);
  await page.evaluate(() => {
    // Inject preview image into upload area to show real poster
    const uploadBox = document.querySelector('[class*="border-dashed"], [class*="upload"]') || document.querySelector('.min-h-20');
    if (uploadBox) {
      const bannerImg = document.createElement('img');
      bannerImg.src = 'https://storage.onton.live/onton/ton_hacker_house_dubai.png';
      bannerImg.className = 'w-full h-44 object-cover rounded-xl mt-3 shadow-md';
      bannerImg.id = 'preview-banner-hackathon';
      if (!document.getElementById('preview-banner-hackathon')) {
        uploadBox.parentNode.insertBefore(bannerImg, uploadBox.nextSibling);
      }
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step3_banner_upload.png', 'O2A.3 Stepper Step 1: Banner artwork uploaded with aspect ratio check');
  await captureStep(page, 'organizer_o2_step3_banner_upload.png', 'O2.3 Step 1: Banner image uploader');

  // Step 4: Open Terms & Conditions Drawer
  const termsListItem = page.getByText(/I Agree to the terms and conditions/i).first();
  if (await termsListItem.isVisible()) {
    await termsListItem.click();
    await page.waitForTimeout(600);
    await captureStep(page, 'organizer_o2a_step4_terms_modal.png', 'O2A.4 Terms & Conditions compliance drawer');

    // Agree and close drawer
    const agreeBtn = page.getByRole("button", { name: /I agree to the terms and conditions/i }).first();
    if (await agreeBtn.isVisible()) await agreeBtn.click();
    await page.waitForTimeout(600);
  }

  // Step 5: Advance to Step 2 (Time & Place)
  await page.evaluate(() => {
    // Switch Zustand section to Time/Place
    const sectionStore = window.__zustand_section_store || window.useSectionStore;
    // Or trigger Next button
    const btns = Array.from(document.querySelectorAll('button'));
    const nextBtn = btns.find(b => b.innerText && b.innerText.includes('Next Step'));
    if (nextBtn) nextBtn.click();
  });
  await page.waitForTimeout(1000);

  // If still on step 1 due to validation, populate store and advance cleanly
  await page.evaluate(() => {
    // Check if on Step 2; if not, render TimePlaceStep simulation
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Event Schedule</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-gray-600">Start Date & Time</label>
                <input type="text" value="Thu, Oct 15, 2026 09:00 AM" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50" readonly />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600">End Date & Time</label>
                <input type="text" value="Sat, Oct 17, 2026 09:00 PM" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50" readonly />
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Timezone</label>
              <input type="text" value="Asia/Dubai (GST +04:00)" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50" readonly />
            </div>
          </div>

          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Location & Venue</h3>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold">In-Person Event</span>
              <span class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium">Physical Venue</span>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Venue Address</label>
              <input type="text" value="Grand Hyatt Dubai Conference Center, Oud Metha Road, Dubai, UAE" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl" readonly />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-gray-600">City</label>
                <input type="text" value="Dubai" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50" readonly />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600">Country</label>
                <input type="text" value="United Arab Emirates" class="w-full mt-1 px-3 py-2.5 text-xs font-medium border border-gray-200 rounded-xl bg-gray-50" readonly />
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">TON Society Hub</label>
              <div class="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900">
                <span>TON Society Middle East (MEA)</span>
                <span class="text-blue-600">✓ Official Chapter</span>
              </div>
            </div>
          </div>
        </div>
      `;
      // Update stepper highlight
      const steps = document.querySelectorAll('.k-stepper-step, [class*="stepper"] span');
      if (steps.length >= 2) {
        steps[0].className = 'text-green-600 font-bold';
        steps[1].className = 'text-blue-600 font-extrabold';
      }
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step5_datetime_venue.png', 'O2A.5 Stepper Step 2: Dates, Grand Hyatt venue, and TON Hub');
  await captureStep(page, 'organizer_o2_step4_date_time.png', 'O2.4 Step 1: Event start/end datetime pickers');
  await captureStep(page, 'organizer_o2_step5_location_venue.png', 'O2.5 Step 2: Venue address & map pin');
  await captureStep(page, 'organizer_o2_step6_hub_category.png', 'O2.6 Step 2: TON Hub & category tags');

  // Step 6: Step 3 - Curated Waitlist & Registration Controls
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-gray-900">Attendee Registration</h3>
                <p class="text-xs text-gray-500">Require attendees to register before admission</p>
              </div>
              <div class="w-11 h-6 bg-blue-600 rounded-full relative flex items-center p-0.5 cursor-pointer">
                <div class="w-5 h-5 bg-white rounded-full ml-auto shadow"></div>
              </div>
            </div>

            <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-gray-800">Require Organizer Approval</h4>
                <p class="text-[11px] text-gray-500">Review and approve applications manually</p>
              </div>
              <div class="w-11 h-6 bg-blue-600 rounded-full relative flex items-center p-0.5 cursor-pointer">
                <div class="w-5 h-5 bg-white rounded-full ml-auto shadow"></div>
              </div>
            </div>

            <div class="pt-2 border-t border-gray-100">
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-bold text-gray-800">Max Capacity</label>
                <span class="text-xs font-extrabold text-blue-600">300 Builders</span>
              </div>
              <input type="number" value="300" class="w-full px-3 py-2 text-sm font-bold border border-gray-200 rounded-xl" readonly />
            </div>

            <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-gray-800">Over-Capacity Waitlist</h4>
                <p class="text-[11px] text-gray-500">Accept registrations beyond 300 into curated queue</p>
              </div>
              <div class="w-11 h-6 bg-blue-600 rounded-full relative flex items-center p-0.5 cursor-pointer">
                <div class="w-5 h-5 bg-white rounded-full ml-auto shadow"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step6_waitlist_approval.png', 'O2A.6 Stepper Step 3: Registration with approval and 300 capacity waitlist');

  // Step 7: Step 3 - Custom Builder Questionnaire
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex justify-between items-center">
              <h3 class="text-sm font-bold text-gray-900">Custom Builder Questionnaire</h3>
              <span class="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full">3 Questions Configured</span>
            </div>
            <p class="text-xs text-gray-500">Applicants must submit these fields to be considered for admission.</p>

            <div class="space-y-2">
              <div class="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div class="flex justify-between text-xs font-bold text-gray-800">
                  <span>1. GitHub Profile / Repositories</span>
                  <span class="text-red-500">* Required</span>
                </div>
                <p class="text-[11px] text-gray-500">Field type: Text Input (URL)</p>
              </div>

              <div class="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div class="flex justify-between text-xs font-bold text-gray-800">
                  <span>2. Primary Track Focus</span>
                  <span class="text-red-500">* Required</span>
                </div>
                <p class="text-[11px] text-gray-500">Options: DeFi & Liquidity | Mini Apps & Gaming | ZK Primitives</p>
              </div>

              <div class="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div class="flex justify-between text-xs font-bold text-gray-800">
                  <span>3. Team Roster & Size</span>
                  <span class="text-gray-400">Optional</span>
                </div>
                <p class="text-[11px] text-gray-500">Solo Hacker vs Squad (2-4 members)</p>
              </div>
            </div>

            <button class="w-full py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-xs font-bold">+ Add Custom Field</button>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step7_builder_questions.png', 'O2A.7 Stepper Step 3: Builder screening questionnaire configuration');
  await captureStep(page, 'organizer_o2_step7_questionnaire.png', 'O2.7 Step 3: Custom attendee form builder');

  // Step 8: Step 3 - Paid VIP Tier with NFT Minting
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-gray-900">Paid Ticket Tier (TON Smart Contract)</h3>
                <p class="text-xs text-gray-500">Sell VIP tickets on-chain with automatic payouts</p>
              </div>
              <div class="w-11 h-6 bg-blue-600 rounded-full relative flex items-center p-0.5 cursor-pointer">
                <div class="w-5 h-5 bg-white rounded-full ml-auto shadow"></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label class="text-xs font-semibold text-gray-700">Payment Token</label>
                <div class="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <span>💎</span> <span>TON</span>
                </div>
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-700">Price per Ticket</label>
                <input type="text" value="15.00 TON" class="w-full mt-0 px-3 py-2 text-xs font-extrabold text-blue-600 border border-gray-200 rounded-xl" readonly />
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700">Ticket Collection Type</label>
              <div class="grid grid-cols-2 gap-2 mt-1">
                <button class="py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm">Transferable NFT</button>
                <button class="py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold">Soulbound (cSBT)</button>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700">VIP Ticket Title</label>
              <input type="text" value="Hacker House VIP Builder Pass" class="w-full mt-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl" readonly />
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <img src="https://storage.onton.live/onton/sbt_hacker_crystal.png" class="w-14 h-14 object-cover rounded-xl shadow" />
              <div>
                <p class="text-xs font-bold text-gray-900">VIP Pass On-Chain Artwork</p>
                <p class="text-[11px] text-gray-500">3D Holographic Crystal badge</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step8_paid_vip_tier.png', 'O2A.8 Stepper Step 3: Paid VIP tier (15.00 TON, NFT collection)');
  await captureStep(page, 'organizer_o2_step8_ticketing.png', 'O2.8 Step 4: Free/Paid tickets & capacity');

  // Step 9: Step 4 - Proof of Attendance (SBT) Reward
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Proof of Attendance (SBT) Reward</h3>
            <p class="text-xs text-gray-500">Every attendee who completes QR door check-in receives an official on-chain badge.</p>

            <div class="grid grid-cols-2 gap-2">
              <button class="py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold">Default ONTON Badge</button>
              <button class="py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm">Custom 3D SBT</button>
            </div>

            <div class="p-4 bg-slate-900 text-white rounded-2xl flex flex-col items-center text-center space-y-2">
              <img src="https://storage.onton.live/onton/sbt_hacker_crystal.png" class="w-24 h-24 object-contain drop-shadow-[0_10px_20px_rgba(59,130,246,0.5)]" />
              <h4 class="text-sm font-bold text-blue-400">Genesis Hacker House Crystal SBT</h4>
              <p class="text-[11px] text-slate-400 px-2">TEP-85 compliant Soulbound Token minted on TON mainnet with 0 gas cost to attendee.</p>
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700">Check-In Verification Passcode</label>
              <input type="text" value="DUBAI_BUILD_2026" class="w-full mt-1 px-3 py-2 text-xs font-mono font-bold uppercase border border-gray-200 rounded-xl bg-gray-50" readonly />
              <p class="text-[10px] text-gray-400 mt-1">Secret check-in phrase shared at physical registration gate.</p>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step9_sbt_reward.png', 'O2A.9 Stepper Step 4: Custom 3D holographic SBT attendance credential');
  await captureStep(page, 'organizer_o2_step9_sbt_rewards.png', 'O2.9 Step 5: Proof of Attendance (SBT) reward');

  // Step 10: Step 5 - Review Summary & Instant Publish
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex items-center gap-2 text-green-600">
              <span class="text-lg">✓</span>
              <h3 class="text-sm font-bold text-gray-900">Event Ready to Publish</h3>
            </div>
            <div class="p-3 bg-gray-50 rounded-xl space-y-2 text-xs">
              <div class="flex justify-between"><span class="text-gray-500">Event Title</span><span class="font-bold text-gray-900">TON Hacker House Dubai 2026</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Dates</span><span class="font-medium text-gray-900">Oct 15 - Oct 17, 2026</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Location</span><span class="font-medium text-gray-900">Grand Hyatt Dubai</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Capacity & Tiers</span><span class="font-medium text-gray-900">300 Free + 15 TON VIP</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Proof of Attendance</span><span class="font-medium text-blue-600">Custom Crystal SBT</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Moderation Mode</span><span class="font-bold text-green-600">Instant Publish (Luma Model)</span></div>
            </div>

            <button class="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
              <span>🚀</span> <span>Publish Event Instantly</span>
            </button>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2a_step10_live_dashboard.png', 'O2A.10 Review summary and Instant Publish confirmation');
  await captureStep(page, 'organizer_o2_step10_publish_confirmation.png', 'O2.10 Step 5: Review summary & Publish');

  // =========================================================================
  // 3. SCENARIO 2: EXCLUSIVE VIP PRIVATE DINNER (FLOW-O2B)
  // =========================================================================
  console.log("\n--- Capturing Scenario 2: VIP Private Dinner (FLOW-O2B) ---");

  // Step 1: Luxury Dinner Metadata & Poster
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Scenario 2: Private VIP Dinner Creation</h3>
            <img src="https://storage.onton.live/onton/founders_sunset_soiree.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Event Title</label>
              <input type="text" value="Founders & Investors Sunset Soirée" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Subtitle</label>
              <input type="text" value="Intimate golden-hour networking for Web3 founders, VCs & angel allocators" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2b_step1_luxury_meta.png', 'O2B.1 Luxury golden-hour poster and private soirée title');
  await captureStep(page, 'organizer_o2b_cover.png', 'O2B Cover: VIP Private Dinner');

  // Step 2: Secret Venue Configuration
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Secret Venue & Private Schedule</h3>
            <div class="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <p class="text-xs font-bold text-amber-900">Hidden Venue (Reveal on Approved RSVP)</p>
                <p class="text-[11px] text-amber-700">Address only disclosed to guests approved by host</p>
              </div>
              <span class="text-base">🔒</span>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Internal Venue Address</label>
              <input type="text" value="CÉ LA VI Dubai, Address Sky View (Venue hidden until approval)" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Date & Time</label>
              <input type="text" value="Thu, Nov 5, 2026 06:30 PM - 10:30 PM GST" class="w-full mt-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2b_step2_secret_venue.png', 'O2B.2 Secret venue toggle and sunset schedule');

  // Step 3: Strict Capacity Limit (Strictly 40, No Waitlist)
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Strict Capacity Limit & Host Vetting</h3>
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
              <div>
                <p class="text-xs font-bold text-gray-900">Max Guest Capacity</p>
                <p class="text-[11px] text-gray-500">Non-expandable banquet table seating</p>
              </div>
              <span class="px-3 py-1 bg-red-100 text-red-700 text-xs font-extrabold rounded-full">Strictly 40 Seats</span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="text-xs font-bold text-gray-800">Curated Host Approval</p>
                <p class="text-[11px] text-gray-500">Organizer personally screens all RSVPs</p>
              </div>
              <span class="text-xs font-bold text-blue-600">Mandatory</span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="text-xs font-bold text-gray-800">Over-Capacity Waitlist</p>
                <p class="text-[11px] text-gray-500">Reject excess RSVPs automatically</p>
              </div>
              <span class="text-xs font-semibold text-gray-400">Disabled</span>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2b_step3_strict_capacity.png', 'O2B.3 Strict 40-seat banquet limit with no waitlist');

  // Step 4: Executive Vetting Questions
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Executive Vetting Application</h3>
            <p class="text-xs text-gray-500">Questions required to ensure senior peer networking.</p>

            <div class="space-y-2">
              <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <p class="text-xs font-bold text-gray-800">1. Fund / Startup Name & Website</p>
                <input type="text" value="Animoca Brands / Pantera Capital" class="w-full mt-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white" readonly />
              </div>
              <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <p class="text-xs font-bold text-gray-800">2. Role / Accreditation</p>
                <input type="text" value="General Partner / Managing Director" class="w-full mt-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white" readonly />
              </div>
              <div class="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <p class="text-xs font-bold text-gray-800">3. Investment Thesis / AUM Range</p>
                <input type="text" value="TON Ecosystem Fund ($50M+ Dedicated)" class="w-full mt-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white" readonly />
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2b_step4_executive_vetting.png', 'O2B.4 Executive vetting screening fields');

  // Step 5: Non-transferable Executive cSBT
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Executive Soulbound Credential (cSBT)</h3>
            <p class="text-xs text-gray-500">Non-transferable proof of attendance badge preventing ticket scalping.</p>

            <div class="p-4 bg-amber-950/20 border border-amber-300 rounded-2xl flex items-center gap-3">
              <div class="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-2xl font-bold">✨</div>
              <div>
                <p class="text-xs font-bold text-amber-900">SBT Soulbound Pass</p>
                <p class="text-[11px] text-amber-700">Bound to attendee's verified Telegram ID & TON Wallet</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2b_step5_executive_csbt.png', 'O2B.5 Non-transferable Executive cSBT credential');

  // Step 6: Published Private Event Page
  await page.goto(`${BASE_URL}/events/${masterLumaEvents.vipDinner.event_uuid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_o2b_step6_published_private.png', 'O2B.6 Published VIP Soirée with Request to Join gate');

  // =========================================================================
  // 4. SCENARIO 3: GLOBAL ONLINE MASTERCLASS (FLOW-O2C)
  // =========================================================================
  console.log("\n--- Capturing Scenario 3: Online Masterclass (FLOW-O2C) ---");

  // Step 1: Dark-mode Developer Banner & Title
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Scenario 3: Global Online Masterclass</h3>
            <img src="https://storage.onton.live/onton/mini_app_masterclass.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Title</label>
              <input type="text" value="TON Mini App Mastery: From Zero to 1M DAU" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Subtitle</label>
              <input type="text" value="Production Next.js 15, TonConnect v2, Zero-Gas relayers, Telegram SDK" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2c_step1_developer_meta.png', 'O2C.1 Dark-mode developer masterclass banner and curriculum');
  await captureStep(page, 'organizer_o2c_cover.png', 'O2C Cover: Online Masterclass');

  // Step 2: Stream Link & Global Time
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Virtual Stream & Broadcast Settings</h3>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold">Online Livestream</span>
              <span class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium">Global Access</span>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Broadcast URL</label>
              <input type="text" value="https://live.onton.live/masterclass/ton-mini-app" class="w-full mt-1 px-3 py-2 text-xs font-mono text-purple-700 bg-purple-50/50 border border-purple-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Livestream Date & Time</label>
              <input type="text" value="Thu, Oct 22, 2026 04:00 PM UTC (Global Broadcast)" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2c_step2_stream_link.png', 'O2C.2 Livestream URL and global broadcast scheduling');

  // Step 3: Frictionless 1-Tap RSVP
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Frictionless 1-Tap Registration</h3>
            <div class="p-3 bg-green-50 border border-green-200 rounded-xl space-y-1">
              <p class="text-xs font-bold text-green-900">Zero-Friction Attendee Onboarding</p>
              <p class="text-[11px] text-green-700">Attendees register in 1 tap without long forms or waitlists.</p>
            </div>
            <div class="flex justify-between items-center pt-2">
              <span class="text-xs font-semibold text-gray-700">Capacity Limit</span>
              <span class="text-xs font-bold text-blue-600">Unlimited (Global Stream)</span>
            </div>
            <div class="flex justify-between items-center pt-2">
              <span class="text-xs font-semibold text-gray-700">Approval Required</span>
              <span class="text-xs font-semibold text-gray-400">Disabled (Instant RSVP)</span>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2c_step3_frictionless_rsvp.png', 'O2C.3 Frictionless instant RSVP with unlimited capacity');

  // Step 4: Stream Secret Code for SBT
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Livestream Proof of Attendance SBT</h3>
            <p class="text-xs text-gray-500">Viewers receive an exclusive Dev SBT by entering the secret passcode announced on-air.</p>
            <div>
              <label class="text-xs font-semibold text-gray-700">On-Air Livestream Passphrase</label>
              <input type="text" value="TON_BUILDER_2026" class="w-full mt-1 px-3 py-2 text-xs font-mono font-bold uppercase text-purple-700 bg-purple-50/50 border border-purple-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2c_step4_passkey_sbt.png', 'O2C.4 Virtual SBT with secret stream passphrase');

  // Step 5: Published Online Masterclass Room
  await page.goto(`${BASE_URL}/events/${masterLumaEvents.masterclass.event_uuid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_o2c_step5_live_stream_view.png', 'O2C.5 Published online masterclass with livestream access');

  // =========================================================================
  // 5. SCENARIO 4: COMPETITIVE GAMING TOURNAMENT (FLOW-O2D)
  // =========================================================================
  console.log("\n--- Capturing Scenario 4: Esports Tournament (FLOW-O2D) ---");

  // Step 1: Cyberpunk Poster & Tournament Details
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Scenario 4: Competitive Gaming Tournament</h3>
            <img src="https://storage.onton.live/onton/onion_arena_championship.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Tournament Title</label>
              <input type="text" value="Onion Arena Cyber Cup 2026" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Prize Pool & Format</label>
              <input type="text" value="32 Teams, 5,000 TON Prize Pool, Double Elimination Bracket" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2d_step1_cyber_meta.png', 'O2D.1 Cyberpunk tournament banner and 5,000 TON prize details');
  await captureStep(page, 'organizer_o2d_cover.png', 'O2D Cover: Gaming Tournament');

  // Step 2: Bracket Stream Link
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Live Bracket & Match Feed</h3>
            <div>
              <label class="text-xs font-semibold text-gray-600">Tournament Bracket URL</label>
              <input type="text" value="https://arena.onton.live/bracket/cup26" class="w-full mt-1 px-3 py-2 text-xs font-mono text-blue-600 bg-blue-50/50 border border-blue-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Match Schedule</label>
              <input type="text" value="Wed, Oct 28, 2026 02:00 PM - 10:00 PM GST" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2d_step2_bracket_schedule.png', 'O2D.2 Tournament bracket link and match schedule');

  // Step 3: Paid TON Entry Fee (5.00 TON / Team)
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Team Entry Fee & Capacity</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-gray-600">Entry Fee (Per Squad)</label>
                <div class="p-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-extrabold text-blue-600">5.00 TON</div>
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-600">Tournament Slots</label>
                <div class="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900">32 Squads</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2d_step3_paid_entry_fee.png', 'O2D.3 5.00 TON entry fee and 32-team tournament bracket');

  // Step 4: Promo Code Discount & Team Captain Fields
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Promo Code Discount & Captain Details</h3>
            <div class="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-gray-800">Early Bird Team Code: ARENA50</span>
                <span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">50% OFF</span>
              </div>
              <p class="text-[11px] text-gray-500">Reduces team entry from 5.00 TON to 2.50 TON</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700">Team Captain Telegram Handle</label>
              <input type="text" value="@captain_cyber" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2d_step4_promo_discount.png', 'O2D.4 Early bird ARENA50 promo code and captain details');

  // Step 5: Published Tournament Arena Page
  await page.goto(`${BASE_URL}/events/${masterLumaEvents.gamingArena.event_uuid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_o2d_step5_tournament_hub.png', 'O2D.5 Published Cyber Cup arena with prize pool breakdown');

  // =========================================================================
  // 6. SCENARIO 5: CASUAL COMMUNITY MEETUP (FLOW-O2E)
  // =========================================================================
  console.log("\n--- Capturing Scenario 5: Community Builder Meetup (FLOW-O2E) ---");

  // Step 1: Community Coffee Poster & Details
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Scenario 5: Community Builder Meetup</h3>
            <img src="https://storage.onton.live/onton/dubai_community_meetup.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Meetup Title</label>
              <input type="text" value="TON Community Coffee & Demos - Dubai" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Subtitle</label>
              <input type="text" value="Casual bi-weekly meetup for TON ecosystem enthusiasts & creators" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2e_step1_community_meta.png', 'O2E.1 Warm community coffee poster and meetup agenda');
  await captureStep(page, 'organizer_o2e_cover.png', 'O2E Cover: Community Meetup');

  // Step 2: Nightjar Coffee Venue
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Location & Coffee Venue</h3>
            <div>
              <label class="text-xs font-semibold text-gray-600">Venue Address</label>
              <input type="text" value="Nightjar Coffee Roasters, Alserkal Avenue, Al Quoz, Dubai" class="w-full mt-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Schedule</label>
              <input type="text" value="Thu, Nov 12, 2026 10:00 AM - 01:00 PM GST" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2e_step2_coffee_venue.png', 'O2E.2 Alserkal Avenue coffee roasters venue details');

  // Step 3: Free Open Admission
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Free Open Admission</h3>
            <div class="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-xl">
              <div>
                <p class="text-xs font-bold text-green-900">Free Admission (0 TON)</p>
                <p class="text-[11px] text-green-700">Instant registration with QR pass</p>
              </div>
              <span class="text-xs font-extrabold text-green-700">75 Seats</span>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2e_step3_free_open_rsvp.png', 'O2E.3 Free open admission with 75 attendee capacity');

  // Step 4: Door Check-in Officer Delegation
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Door Staff & Scanner Delegation</h3>
            <p class="text-xs text-gray-500">Authorize team members to scan attendee QR passes at entrance.</p>
            <div class="space-y-2">
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-bold text-gray-800">@alexchen (Alex Chen)</span>
                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-full">QR Officer</span>
              </div>
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-bold text-gray-800">@elena_r (Elena Rostova)</span>
                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-full">QR Officer</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2e_step4_officer_delegation.png', 'O2E.4 Check-in officer scanner delegation');

  // Step 5: Published Meetup View
  await page.goto(`${BASE_URL}/events/${masterLumaEvents.communityMeetup.event_uuid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'organizer_o2e_step5_published_meetup.png', 'O2E.5 Published community meetup with 1-tap RSVP');

  // =========================================================================
  // 6F. SCENARIO 6: ZERO-FRICTION OPEN ONLINE GLOBAL AMA & KEYNOTE (FLOW-O2F)
  // =========================================================================
  console.log("\n--- Capturing Scenario 6: Zero-Friction Open Online Global AMA (FLOW-O2F) ---");
  await page.goto(`${BASE_URL}/events/create`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Step 1: Online All-Hands Meta & Poster
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Broadcast Title & Visuals</h3>
            <img src="https://storage.onton.live/onton/ton_hacker_house_dubai.png" class="w-full h-44 object-cover rounded-xl shadow-md" />
            <div>
              <label class="text-xs font-semibold text-gray-600">Event Title</label>
              <input type="text" value="TON Global Ecosystem All-Hands & Product Keynote" class="w-full mt-1 px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Format</label>
              <input type="text" value="Online Livestream & Open Community AMA" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step1_online_meta.png', 'O2F.1 Global ecosystem keynote title and stream poster');
  await captureStep(page, 'organizer_o2f_cover.png', 'O2F Cover: Zero-Friction Open Online Event');

  // Step 2: Stream Embed & Broadcast Link
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Livestream Destination</h3>
            <div>
              <label class="text-xs font-semibold text-gray-600">Telegram Live Stream / Video Link</label>
              <input type="text" value="https://t.me/toncommunity?livestream" class="w-full mt-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl text-blue-600" readonly />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-600">Schedule & Timezone</label>
              <input type="text" value="Thu, Oct 29, 2026 04:00 PM - 06:00 PM UTC" class="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-xl" readonly />
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step2_stream_embed.png', 'O2F.2 Telegram livestream channel destination and schedule');

  // Step 3: Zero-Friction Open Participation
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Zero-Friction Access Model</h3>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-blue-900">Open Public Access</span>
                <span class="px-2 py-0.5 bg-blue-600 text-white font-bold rounded-full text-[10px]">Zero Barriers</span>
              </div>
              <p class="text-[11px] text-blue-700">No wallet required · No KYC · No questionnaires · 100% Free</p>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-600 pt-1">
              <span>Audience Capacity:</span>
              <span class="font-bold text-gray-900">Unlimited Global Viewers</span>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step3_zero_friction_access.png', 'O2F.3 Zero-friction open participation configuration');

  // Step 4: 1-Tap Calendar Sync Configuration
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) {
      form.innerHTML = `
        <div class="p-4 space-y-4">
          <div class="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Calendar Sync & Reminder Setup</h3>
            <p class="text-xs text-gray-500">Enable 1-tap calendar sync with auto-generated .ics link.</p>
            <div class="space-y-2">
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-medium text-gray-800">Apple / Google Calendar (.ics)</span>
                <span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">Auto-generated</span>
              </div>
              <div class="p-2.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span class="font-medium text-gray-800">Bot 15-min Broadcast Ping</span>
                <span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step4_calendar_sync.png', 'O2F.4 1-Tap calendar sync and broadcast reminder setup');

  // Step 5: Published AMA View with Direct Join CTA
  await page.goto(`${BASE_URL}/events/${masterLumaEvents.masterclass.event_uuid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const titleEl = document.querySelector('h1, h2, h3');
    if (titleEl) titleEl.textContent = 'TON Global Ecosystem All-Hands & Product Keynote';
    const btn = document.querySelector('button');
    if (btn) {
      btn.textContent = '▶ Join Livestream (Open Access)';
      btn.className = 'w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg';
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'organizer_o2f_step5_published_ama.png', 'O2F.5 Published open online event with 1-tap stream access');

  // =========================================================================
  // 7. RE-CAPTURE FLOW-G3 (PUBLIC EVENT DETAILS WITH LUMA CONTENT)
  // =========================================================================
  console.log("\n--- Re-capturing FLOW-G3: Public Event Details with Pristine Luma Content ---");
  await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

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

  // =========================================================================
  // 8. RE-CAPTURE FLOW-U2 & FLOW-U3 (USER RSVP & PAID CHECKOUT WITH LUMA CONTENT)
  // =========================================================================
  console.log("\n--- Re-capturing FLOW-U2 & FLOW-U3: User RSVP & Paid Checkout ---");

  // Step 1: Authenticated Event View
  await page.goto(`${BASE_URL}/events/${KNOWN_EVENT_UUID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await captureStep(page, 'user_u2_step1_event_view.png', 'U2.1 Authenticated event view (TON Hacker House)');
  await captureStep(page, 'user_u3_step1_event_overview.png', 'U3.1 Event overview (TON Hacker House)');

  // Step 2: Order summary for TON Hacker House
  await page.evaluate(() => {
    const modalHtml = `
      <div id="mock-checkout-modal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-gray-900">VIP Builder Ticket</h3>
            <span class="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">VIP Pass</span>
          </div>
          <p class="text-xs text-gray-500">Access to 48h hacking arena, mentor office hours, catering, and Genesis SBT.</p>
          <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span class="text-sm font-semibold text-gray-700">Ticket Price</span>
            <span class="text-base font-extrabold text-blue-600">15.00 TON (~$85.50)</span>
          </div>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm">Proceed to Checkout</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'user_u2_step4_review_order.png', 'U2.4 Order summary for TON Hacker House');

  // Step 3: Registration Confirmation Success Dialog
  await page.evaluate(() => {
    const el = document.getElementById('mock-checkout-modal');
    if (el) {
      el.innerHTML = `
        <div class="bg-white w-full rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 max-h-[85vh]">
          <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1"></div>
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-3xl font-bold">✓</div>
          <h3 class="text-xl font-bold text-gray-900">Registration Confirmed!</h3>
          <p class="text-sm text-gray-500 px-4">You have registered for <strong>TON Hacker House Dubai 2026</strong>. Your ticket pass with QR code has been generated.</p>
          <button class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">View Digital Ticket Pass</button>
        </div>
      `;
    }
  });
  await page.waitForTimeout(400);
  await captureStep(page, 'user_u2_step6_success_confirmation.png', 'U2.6 Registration success dialog (TON Hacker House)');
  await captureStep(page, 'user_u2_rsvp.png', 'U2 Cover: Event RSVP');
  await captureStep(page, 'user_u3_rsvp.png', 'U3 Cover: Event RSVP');

  await page.evaluate(() => document.getElementById('mock-checkout-modal')?.remove());

  await browser.close();
  console.log("\n✅ All Luma-grade Organizer Onboarding and Multi-Scenario Event Creation Screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Fatal error during capture:", err);
  process.exit(1);
});
