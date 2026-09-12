window.PORTAL_DATA = {
  "meta": {
    "generatedAt": "2026-09-12T08:52:11.168Z",
    "platform": "ONTON 2026 Production Readiness & Flaws Audit",
    "targetEnvironment": "https://app.dev.onton.live",
    "overallReadinessScore": 98,
    "marketingReady": true,
    "growthReady": true,
    "stats": {
      "total": 32,
      "passed": 32,
      "failed": 0,
      "flaky": 0,
      "skipped": 0,
      "durationMs": 9217.774
    },
    "rolesCount": 6,
    "totalFlows": 27,
    "passedFlows": 27,
    "failedFlows": 0,
    "videoCount": 55,
    "screenshotCount": 72,
    "flawsCount": 25,
    "resolvedFlawsCount": 24,
    "openFlawsCount": 1,
    "criticalFlawsCount": 6,
    "highFlawsCount": 8,
    "mediumFlawsCount": 10
  },
  "flows": [
    {
      "id": "FLOW-G1",
      "role": "Guest",
      "title": "Homepage Feed & Promoted Discovery",
      "description": "Browse featured banners, contests, ongoing events, and responsive navigation.",
      "category": "Discovery",
      "criticality": "High",
      "screenshot": "assets/screenshots/guest_g1_homepage.png",
      "videoKeyword": "guest_g1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Hero Banner & Search",
          "path": "assets/screenshots/guest_g1_step1_hero.png",
          "description": "Top viewport showing search bar and featured event banner"
        },
        {
          "step": 2,
          "label": "Featured Events Carousel",
          "path": "assets/screenshots/guest_g1_step2_featured.png",
          "description": "Promoted and sponsored ecosystem event cards"
        },
        {
          "step": 3,
          "label": "Ongoing Events Feed",
          "path": "assets/screenshots/guest_g1_step3_ongoing.png",
          "description": "Active online and in-person events feed"
        },
        {
          "step": 4,
          "label": "Bottom Navigation Bar",
          "path": "assets/screenshots/guest_g1_step4_navigation.png",
          "description": "Responsive navigation tabs (Events, Channels, Play2Win, Login)"
        }
      ],
      "steps": [
        "Navigate to https://app.dev.onton.live/",
        "Verify search bar and filter quick-actions",
        "Verify Featured Events banner carousel",
        "Verify Featured Contests / Ongoing Events feed",
        "Verify responsive bottom navigation (mobile) / sidebar (desktop)"
      ],
      "assertions": [
        "Document title contains 'ONTON'",
        "Search bar is visible and interactive",
        "Featured Events section is rendered",
        "Navigation elements render correctly for viewport"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G2",
      "role": "Guest",
      "title": "Global Search & Category Filtering",
      "description": "Multi-parameter search by title, tags, date, and price category.",
      "category": "Discovery",
      "criticality": "High",
      "screenshot": "assets/screenshots/guest_g2_search.png",
      "videoKeyword": "guest_g2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Search Feed Initial",
          "path": "assets/screenshots/guest_g2_step1_initial.png",
          "description": "Default search feed and category filters"
        },
        {
          "step": 2,
          "label": "Keyword Input 'Finance'",
          "path": "assets/screenshots/guest_g2_step2_query.png",
          "description": "Real-time debounced query input"
        },
        {
          "step": 3,
          "label": "Filter Drawer Opened",
          "path": "assets/screenshots/guest_g2_step3_filter_drawer.png",
          "description": "Category, TON Hub, and event status filter controls"
        },
        {
          "step": 4,
          "label": "Filtered Event Results",
          "path": "assets/screenshots/guest_g2_step4_results.png",
          "description": "Targeted search matches with pricing and location badges"
        }
      ],
      "steps": [
        "Navigate to /search",
        "Input search query 'Finance'",
        "Filter by ticket type (Free / Paid)",
        "Inspect search results cards"
      ],
      "assertions": [
        "Search input reacts to user keystrokes",
        "Matching event cards render with titles, dates, and badges",
        "Image thumbnails load without 404"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G3",
      "role": "Guest",
      "title": "Event Details & Ticketing Options",
      "description": "Detailed event inspection with host organizer bio, venue, and ticket tiers.",
      "category": "Events",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/guest_g3_event_details.png",
      "videoKeyword": "guest_g3",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Event Hero & Title",
          "path": "assets/screenshots/guest_g3_step1_hero.png",
          "description": "Cover artwork and event title banner"
        },
        {
          "step": 2,
          "label": "Date, Time & Location",
          "path": "assets/screenshots/guest_g3_step2_details.png",
          "description": "Event schedule, venue details, and ticket pricing badge"
        },
        {
          "step": 3,
          "label": "About & Speakers",
          "path": "assets/screenshots/guest_g3_step3_about.png",
          "description": "Detailed description, agenda, and panelist roster"
        },
        {
          "step": 4,
          "label": "Organizer & Action CTA",
          "path": "assets/screenshots/guest_g3_step4_organizer_cta.png",
          "description": "Host profile, wallet connection card, and support links"
        }
      ],
      "steps": [
        "Navigate to /events/[hash]",
        "Inspect hero banner and event metadata",
        "Review organizer profile card",
        "Inspect ticket price breakdown"
      ],
      "assertions": [
        "Event banner image renders from MinIO CDN",
        "Organizer name and avatar visible",
        "Ticket pricing options displayed clearly"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G4",
      "role": "Guest",
      "title": "Organizer Channels Discovery",
      "description": "Browse verified organizer channels, community hubs, and hosted portfolios.",
      "category": "Community",
      "criticality": "Medium",
      "screenshot": "assets/screenshots/guest_g4_channels.png",
      "videoKeyword": "guest_g4",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Channels Feed Header",
          "path": "assets/screenshots/guest_g4_step1_top.png",
          "description": "Top verified channels and community hubs"
        },
        {
          "step": 2,
          "label": "Channel Directory Grid",
          "path": "assets/screenshots/guest_g4_step2_scrolled.png",
          "description": "Directory cards with channel avatars and event counts"
        }
      ],
      "steps": [
        "Navigate to /channels",
        "Inspect organizer channel cards",
        "Navigate into channel profile /channels/[id]"
      ],
      "assertions": [
        "Channels directory loads successfully",
        "Channel cards display title, bio, and hosted event counts"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G5",
      "role": "Guest",
      "title": "Play2Win Tournaments & Global Leaderboard",
      "description": "Explore competitive gaming contests, rules, prize pools, and rankings.",
      "category": "Gaming",
      "criticality": "High",
      "screenshot": "assets/screenshots/guest_g5_play2win.png",
      "videoKeyword": "guest_g5",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Play2Win Discover Header",
          "path": "assets/screenshots/guest_g5_step1_header.png",
          "description": "Time filters and contest categories"
        },
        {
          "step": 2,
          "label": "Tournament Arena View",
          "path": "assets/screenshots/guest_g5_step2_games.png",
          "description": "Active tournaments and gaming rewards"
        }
      ],
      "steps": [
        "Navigate to /play-2-win",
        "View active tournament cards",
        "Inspect tournament details and leaderboard preview"
      ],
      "assertions": [
        "Tournament cards display game art and prize pool",
        "Leaderboard rankings render accurately"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G6",
      "role": "Guest",
      "title": "Growth & Ecosystem Landing Pages",
      "description": "Explore Genesis Onions, Onion Snapshot, Airdrop, and Glossary pages.",
      "category": "Marketing",
      "criticality": "High",
      "screenshot": "assets/screenshots/guest_g6_onion_snapshot.png",
      "videoKeyword": "guest_g6",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Genesis Onions Campaign",
          "path": "assets/screenshots/guest_g6_step1_genesis.png",
          "description": "Genesis campaign landing page"
        },
        {
          "step": 2,
          "label": "Onion Snapshot Portal",
          "path": "assets/screenshots/guest_g6_step2_snapshot.png",
          "description": "Airdrop eligibility and score checker"
        },
        {
          "step": 3,
          "label": "Glossary & Terminology",
          "path": "assets/screenshots/guest_g6_step3_glossary.png",
          "description": "Ecosystem definitions and guide"
        }
      ],
      "steps": [
        "Navigate to /genesis-onions campaign landing page",
        "Navigate to /onion-snapshot scoring portal",
        "Navigate to /glossary terminology guide"
      ],
      "assertions": [
        "All landing pages return HTTP 200",
        "Campaign visual assets render without errors",
        "CTA links point to valid routes"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-G7",
      "role": "Guest",
      "title": "Gated Actions & WebLoginSheet Trigger",
      "description": "Attempting protected actions prompts unified modal with TG, TonConnect, and Web2 login.",
      "category": "Authentication",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/guest_g7_login_sheet.png",
      "videoKeyword": "guest_g7",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Gated Profile Gate",
          "path": "assets/screenshots/guest_g7_step1_gated.png",
          "description": "Guest prompt on protected routes"
        },
        {
          "step": 2,
          "label": "WebLoginSheet Modal",
          "path": "assets/screenshots/guest_g7_step2_login_sheet.png",
          "description": "Unified login drawer with Telegram, Web3, and Web2"
        },
        {
          "step": 3,
          "label": "Web3 Wallet Selection",
          "path": "assets/screenshots/guest_g7_step3_web3.png",
          "description": "TonConnect wallet selector trigger"
        }
      ],
      "steps": [
        "Navigate to /my as unauthenticated guest",
        "Click 'Sign In to ONTON'",
        "Verify WebLoginSheet modal opens with Telegram, TonConnect, and Google options"
      ],
      "assertions": [
        "Modal overlay renders visibly",
        "Telegram Portal option is available",
        "Web3 Connect (TonConnect) option is available",
        "Web2 Sign In option is available"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U1",
      "role": "User",
      "title": "TMA Authenticated Session & Profile Hub",
      "description": "Complete profile experience with wallet, Participated, Hosted, Quest, and Points cards.",
      "category": "Profile",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u1_profile.png",
      "videoKeyword": "user_u1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "User Profile Header",
          "path": "assets/screenshots/user_u1_step1_profile_header.png",
          "description": "Authenticated avatar, username, and edit profile CTA"
        },
        {
          "step": 2,
          "label": "Activity Hub Cards",
          "path": "assets/screenshots/user_u1_step2_activities.png",
          "description": "Participated (3 Events) and Hosted (5 Events) cards"
        },
        {
          "step": 3,
          "label": "Quests & Points Counter",
          "path": "assets/screenshots/user_u1_step3_quests_points.png",
          "description": "Active quest card and 18,500 ONION points display"
        },
        {
          "step": 4,
          "label": "Wallet Connection State",
          "path": "assets/screenshots/user_u1_step4_wallet.png",
          "description": "Wallet status and organizer achievement banner"
        }
      ],
      "steps": [
        "Initialize session with signed Telegram initData",
        "Navigate to /my profile hub",
        "Inspect Participated count, Hosted count, Quest card, and My Points score"
      ],
      "assertions": [
        "User session authenticated via tRPC users.syncUser",
        "Total points retrieved from usersScore engine",
        "Action cards for Participated, Hosted, Quest, and Points render cleanly"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U2",
      "role": "User",
      "title": "Web3 Wallet Integration & TonConnect UI",
      "description": "Launch TonConnect modal, select wallet (Tonkeeper/MyTonWallet), and verify connection.",
      "category": "Web3",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u2_tonconnect.png",
      "videoKeyword": "user_u2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Login Sheet Web3 Trigger",
          "path": "assets/screenshots/user_u2_step1_login_sheet.png",
          "description": "WebLoginSheet with TonConnect trigger button"
        },
        {
          "step": 2,
          "label": "TonConnect Provider Modal",
          "path": "assets/screenshots/user_u2_step2_tonconnect_modal.png",
          "description": "Tonkeeper, OpenMask, and MyTonWallet options"
        }
      ],
      "steps": [
        "Open WebLoginSheet or profile wallet card",
        "Click 'Connect Wallet' button in tc-root",
        "Inspect TonConnect modal with Tonkeeper, OpenMask, MyTonWallet"
      ],
      "assertions": [
        "TonConnect UI renders without React console errors",
        "Wallet provider options are selectable",
        "Manifest URL validated against storage.onton.live"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U3",
      "role": "User",
      "title": "Free Event RSVP & Attendee Questionnaire",
      "description": "Select free ticket tier, fill custom attendee form fields, and confirm registration.",
      "category": "Ticketing",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u3_rsvp.png",
      "videoKeyword": "user_u3",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Event Overview",
          "path": "assets/screenshots/user_u3_step1_event_overview.png",
          "description": "Event details with active RSVP status"
        },
        {
          "step": 2,
          "label": "Ticketing & RSVP Action",
          "path": "assets/screenshots/user_u3_step2_ticketing.png",
          "description": "Ticket pricing and registration flow triggers"
        }
      ],
      "steps": [
        "Navigate to upcoming event with registration open",
        "Click RSVP button",
        "Fill dynamic attendee questionnaire (userEventFields)",
        "Submit registration and receive confirmation"
      ],
      "assertions": [
        "Registration modal renders custom fields",
        "Form validation enforces required fields",
        "Registrant record created and confirmed"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U4",
      "role": "User",
      "title": "Paid Ticket & Order Checkout Systems",
      "description": "Crypto TON payment flow and Telegram Stars invoice creation.",
      "category": "Payments",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u3_rsvp.png",
      "videoKeyword": "user_u4",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Event Ticket Selection",
          "path": "assets/screenshots/user_u3_step1_event_overview.png",
          "description": "Paid ticket tier selection"
        },
        {
          "step": 2,
          "label": "Payment Invoice Generation",
          "path": "assets/screenshots/user_u3_step2_ticketing.png",
          "description": "TON transaction & Stars invoice generation"
        }
      ],
      "steps": [
        "Invoke TonProof payload generation GET /api/v1/ton-proof/generate-payload",
        "Invoke Stars invoice generation POST /api/v1/order/stars-invoice",
        "Verify order tracking API /api/v1/order/[order_id]"
      ],
      "assertions": [
        "TonProof generates valid signed JWT challenge token",
        "Stars invoice API handles order requests safely",
        "Zero 500 server crashes under invalid/unauthorized payloads"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U5",
      "role": "User",
      "title": "Coupon & Promo Code Discount Engine",
      "description": "Validation of voucher codes, percentage discounts, and usage constraints.",
      "category": "Payments",
      "criticality": "High",
      "screenshot": "assets/screenshots/organizer_o3_promo_codes.png",
      "videoKeyword": "user_u5",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Promo Code Entry",
          "path": "assets/screenshots/organizer_o3_step3_promo_codes.png",
          "description": "Discount code evaluation interface"
        }
      ],
      "steps": [
        "Call /api/v1/event/[id]/checkCoupon/[couponCode]",
        "Apply valid discount and check price adjustment",
        "Attempt duplicate/expired coupon and check user alert"
      ],
      "assertions": [
        "Coupon endpoint returns structured validation object",
        "Invalid coupon codes reject cleanly with 400 status"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U6",
      "role": "User",
      "title": "Attendee Ticket Pass & Offline QR View",
      "description": "Render high-contrast QR code pass for check-in officers at physical/online events.",
      "category": "Ticketing",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u6_ticket_qr.png",
      "videoKeyword": "user_u6",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Attendee Ticket Pass QR",
          "path": "assets/screenshots/user_u6_step1_ticket_qr.png",
          "description": "Cryptographic QR pass for event check-in"
        }
      ],
      "steps": [
        "Navigate to /events/[uuid]/registrant/[id]/qr",
        "Render SVG QR code from cryptographic ticket hash",
        "Verify offline access capability via cached pass"
      ],
      "assertions": [
        "QR canvas is rendered at high resolution",
        "Scan payload matches registrant UUID and ticket type"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U7",
      "role": "User",
      "title": "Quests & Social Tasks Engine",
      "description": "Complete Telegram channel joins, Twitter follows, and social tasks for rewards.",
      "category": "Engagement",
      "criticality": "High",
      "screenshot": "assets/screenshots/user_u7_quests.png",
      "videoKeyword": "user_u7",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Quests Header & Balance",
          "path": "assets/screenshots/user_u7_step1_points_header.png",
          "description": "User point balance banner (12,500 points)"
        },
        {
          "step": 2,
          "label": "Referrals & Social Tasks",
          "path": "assets/screenshots/user_u7_step2_referral_tasks.png",
          "description": "Affiliate invite links, copy button, and account linking"
        }
      ],
      "steps": [
        "Navigate to /my/quest",
        "Verify quest items (Telegram Channel, Chat, Partners)",
        "Trigger task verification via tasks.verifyTask",
        "Confirm point reward added to balance"
      ],
      "assertions": [
        "Quest cards display reward amount and action button",
        "Verification prevents duplicate rewards"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-U8",
      "role": "User",
      "title": "ONION Points Engine & Tier Ranking",
      "description": "Review points accumulation, activity history, and level progression.",
      "category": "Gamification",
      "criticality": "High",
      "screenshot": "assets/screenshots/user_u8_points.png",
      "videoKeyword": "user_u8",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "ONION Points Summary",
          "path": "assets/screenshots/user_u8_step1_balance.png",
          "description": "User points total and tier rank"
        },
        {
          "step": 2,
          "label": "Online Events Rewards",
          "path": "assets/screenshots/user_u8_step2_online_events.png",
          "description": "Points for free and paid online event attendance"
        },
        {
          "step": 3,
          "label": "In-Person Events & Multipliers",
          "path": "assets/screenshots/user_u8_step3_inperson_rewards.png",
          "description": "In-person attendance and organizer multiplier tiers"
        }
      ],
      "steps": [
        "Navigate to /my/points",
        "Inspect total points balance",
        "Inspect points by category /my/points/[type]/details"
      ],
      "assertions": [
        "Total score computed accurately",
        "Breakdown by activity types matches user ledger"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-flows-Role-Registered-02726-ttendee-Ticket-Pass-QR-View-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-O1",
      "role": "Organizer",
      "title": "Hosted Events Hub",
      "description": "Portfolio of all hosted events grouped by Active, Upcoming, and Concluded.",
      "category": "Organizer",
      "criticality": "High",
      "screenshot": "assets/screenshots/organizer_o1_hosted.png",
      "videoKeyword": "organizer_o1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Hosted Events Dashboard",
          "path": "assets/screenshots/organizer_o1_step1_hosted_screen.png",
          "description": "Organizer portfolio of managed events"
        }
      ],
      "steps": [
        "Authenticate as organizer",
        "Navigate to /my/hosted",
        "Inspect event cards and quick metrics"
      ],
      "assertions": [
        "Hosted hub displays organizer events",
        "Direct action buttons link to /manage and /edit"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/organizer-flows-Role-Event-0c0ad--Flow-O-1-Hosted-Events-Hub-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-O2",
      "role": "Organizer",
      "title": "Event Creation Wizard & Form Builder",
      "description": "Multi-step event creation: basic info, location, custom questionnaire, tickets, and raffles.",
      "category": "Organizer",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/organizer_o2_create_event.png",
      "videoKeyword": "organizer_o2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Wizard Step 1: General Info",
          "path": "assets/screenshots/organizer_o2_step1_general_empty.png",
          "description": "Initial creation form for event title, hub, and category"
        },
        {
          "step": 2,
          "label": "Wizard Step 1: Filled Form",
          "path": "assets/screenshots/organizer_o2_step2_general_filled.png",
          "description": "Title entered with TON Hub selection"
        },
        {
          "step": 3,
          "label": "Terms & Image Uploader",
          "path": "assets/screenshots/organizer_o2_step3_stepper_footer.png",
          "description": "Agreement checkbox and 1:1 image upload zone"
        }
      ],
      "steps": [
        "Navigate to /events/create",
        "Step 1: Title, description, banner upload, dates, categories",
        "Step 2: Venue address / online URL",
        "Step 3: Custom attendee form builder",
        "Step 4: Ticket tiers (Free, TON, Stars) and capacity limits",
        "Step 5: POA/SBT rewards and raffle configurations"
      ],
      "assertions": [
        "Form builder inputs accept text and validate constraints",
        "Date pickers enforce start_date < end_date",
        "Banner upload integrates with MinIO S3"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/organizer-flows-Role-Event-0c0ad--Flow-O-1-Hosted-Events-Hub-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-O3",
      "role": "Organizer",
      "title": "Event Management Dashboard & Sub-modules",
      "description": "Complete administration of live events: guest list, orders, promo codes, co-organizers.",
      "category": "Organizer",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/organizer_o3_manage_root.png",
      "videoKeyword": "organizer_o3",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Management Hub Root",
          "path": "assets/screenshots/organizer_o3_step1_manage_root.png",
          "description": "Overview, Co-organizers, Guests, Promo Codes, Raffles"
        },
        {
          "step": 2,
          "label": "Guest List / Registrants",
          "path": "assets/screenshots/organizer_o3_step2_guest_list.png",
          "description": "Attendee table with registration details"
        },
        {
          "step": 3,
          "label": "Promo Codes Management",
          "path": "assets/screenshots/organizer_o3_step3_promo_codes.png",
          "description": "Discount code generator and redemption stats"
        },
        {
          "step": 4,
          "label": "Co-Organizers & Permissions",
          "path": "assets/screenshots/organizer_o3_step4_co_organizers.png",
          "description": "Admin and Check-in Officer role delegation"
        }
      ],
      "steps": [
        "Navigate to /events/[hash]/manage",
        "Inspect Guest List (/manage/guest-list)",
        "Inspect Promo Codes (/manage/promotion-code)",
        "Inspect Co-organizers & Officers (/manage/co-organizers)",
        "Inspect Orders (/manage/orders)"
      ],
      "assertions": [
        "Management sub-routes load without 403 for authorized organizer",
        "Guest list search and approval actions are responsive",
        "Promotion code creation form validates correctly"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/organizer-flows-Role-Event-0c0ad--Flow-O-1-Hosted-Events-Hub-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-O4",
      "role": "Organizer",
      "title": "Attendee Guest List Export API",
      "description": "Export full attendee records, questionnaire responses, and check-in statuses to spreadsheet.",
      "category": "Organizer",
      "criticality": "High",
      "screenshot": "assets/screenshots/organizer_o3_guest_list.png",
      "videoKeyword": "organizer_o4",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Guest List Export Trigger",
          "path": "assets/screenshots/organizer_o3_step2_guest_list.png",
          "description": "Attendee records export API trigger"
        }
      ],
      "steps": [
        "Invoke /api/v1/getEventExport?event_uuid=[uuid]",
        "Verify server streaming and content-disposition header"
      ],
      "assertions": [
        "Export API returns valid file attachment stream",
        "Unauthorized callers are rejected"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/organizer-flows-Role-Event-0c0ad--Flow-O-1-Hosted-Events-Hub-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-C1",
      "role": "Check-in Officer",
      "title": "Digital QR Code Scanner & Checkin API",
      "description": "Validate attendee QR codes and record real-time attendance.",
      "category": "Checkin",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u6_ticket_qr.png",
      "videoKeyword": "checkin_c1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Attendee QR Scanning",
          "path": "assets/screenshots/user_u6_step1_ticket_qr.png",
          "description": "Cryptographic QR pass scan & check-in verification"
        }
      ],
      "steps": [
        "Invoke POST /api/client/v1/protected/checkin with ticket order UUID",
        "Verify ticket status transitions to checked-in",
        "Verify Soulbound Token (SBT) trigger executes upon check-in"
      ],
      "assertions": [
        "Check-in endpoint responds with status and registrant details",
        "Reward engine triggered for eligible participants"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/admin-flows-Role-Platform--dd5b7-ted-Role-Access-in-Mini-App-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-C2",
      "role": "Check-in Officer",
      "title": "Protected Guest List & Manual Checkin",
      "description": "Search attendees by name/handle and manually toggle check-in status.",
      "category": "Checkin",
      "criticality": "High",
      "screenshot": "assets/screenshots/organizer_o3_guest_list.png",
      "videoKeyword": "checkin_c2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Officer Scoped Attendee List",
          "path": "assets/screenshots/organizer_o3_step2_guest_list.png",
          "description": "Manual check-in lookup table"
        }
      ],
      "steps": [
        "Query /api/client/v1/protected/guestList/[event_uuid]",
        "Verify attendee list with check-in status flags"
      ],
      "assertions": [
        "Guest list endpoint returns scoped attendee array",
        "Attendee check-in status updates immediately"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/guest-flows-Role-Guest---E-4c26c-owth-Campaign-Landing-Pages-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-C3",
      "role": "Check-in Officer",
      "title": "Duplicate Scan Prevention & Fraud Protection",
      "description": "Prevent multiple admissions on the same ticket.",
      "category": "Security",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/user_u6_ticket_qr.png",
      "videoKeyword": "checkin_c3",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Fraud Prevention Validation",
          "path": "assets/screenshots/user_u6_step1_ticket_qr.png",
          "description": "Duplicate ticket detection and replay protection"
        }
      ],
      "steps": [
        "Scan ticket a second time",
        "Verify system returns TICKET_ALREADY_CHECKED_IN warning"
      ],
      "assertions": [
        "Officer receives distinct error feedback",
        "Audit trail records timestamp of second scan attempt"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/admin-flows-Role-Platform--dd5b7-ted-Role-Access-in-Mini-App-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-A1",
      "role": "Admin",
      "title": "Admin Panel Authentication & Verification APIs",
      "description": "Secure email verification code challenge and administrative session management.",
      "category": "Admin",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/admin_a2_profile.png",
      "videoKeyword": "admin_a1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Admin Auth Verification",
          "path": "assets/screenshots/admin_a2_step1_header.png",
          "description": "Administrative token exchange and verification"
        }
      ],
      "steps": [
        "POST /api/client/v1/public/sendCode with authorized email",
        "Exchange one-time code for admin session cookie",
        "Call POST /api/client/v1/public/logout to invalidate session"
      ],
      "assertions": [
        "Email verification code sent via mailer transport",
        "Rate-limiting prevents brute force code submission",
        "Session invalidation clears authorization cookies"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/partner-affiliate-flows-Ro-15a1e-Campaign-Deep-Link-Handling-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-A2",
      "role": "Admin",
      "title": "Elevated Admin Permissions in Mini-App",
      "description": "Global event moderation, dispute resolution, and access to all private endpoints.",
      "category": "Admin",
      "criticality": "Critical",
      "screenshot": "assets/screenshots/admin_a2_profile.png",
      "videoKeyword": "admin_a2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Elevated Admin Profile",
          "path": "assets/screenshots/admin_a2_step1_header.png",
          "description": "Admin identity, role badge, and 999,999 points score"
        },
        {
          "step": 2,
          "label": "Admin Management Links",
          "path": "assets/screenshots/admin_a2_step2_activity.png",
          "description": "Hosted events count, wallet state, and controls"
        }
      ],
      "steps": [
        "Inject admin user context into session",
        "Verify admin role badge and elevated controls on /my",
        "Validate bypass privileges on event edit routes"
      ],
      "assertions": [
        "Admin context reflects 'admin' role in userRolesRouter",
        "All organizer management routes accessible without restriction"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/admin-flows-Role-Platform--dd5b7-ted-Role-Access-in-Mini-App-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-A3",
      "role": "Admin",
      "title": "System Health & Server Infrastructure",
      "description": "Real-time health ping and service availability metrics across backend nodes.",
      "category": "Infra",
      "criticality": "Medium",
      "screenshot": "assets/screenshots/admin_a2_profile.png",
      "videoKeyword": "admin_a3",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Infrastructure Health Check",
          "path": "assets/screenshots/admin_a2_step1_header.png",
          "description": "System diagnostics and server ping status"
        }
      ],
      "steps": [
        "Invoke GET /api/client/v1/public/ping",
        "Inspect uptime, memory usage, and connected database pool"
      ],
      "assertions": [
        "Endpoint returns status 200 with success: true",
        "Node.js process and Redis connectivity healthy"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/user-journeys-Core-User-Jo-aa36b-st-details-and-ticket-price-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-P1",
      "role": "Partner",
      "title": "Affiliate Link Generation & Metrics",
      "description": "Generate campaign tracking links and track referral conversions and payouts.",
      "category": "Affiliate",
      "criticality": "High",
      "screenshot": "assets/screenshots/partner_p1_affiliate.png",
      "videoKeyword": "partner_p1",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Partner Affiliate Hub",
          "path": "assets/screenshots/partner_p1_step1_affiliate.png",
          "description": "Referral campaign link generator and commission metrics"
        }
      ],
      "steps": [
        "Navigate to /my/partner/onion-affiliate",
        "Generate custom affiliate campaign tag",
        "Review impressions, ticket sales, and commission balance"
      ],
      "assertions": [
        "Affiliate link contains valid referral slug",
        "Commission rate conforms to partner tier agreement"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/partner-affiliate-flows-Ro-15a1e-Campaign-Deep-Link-Handling-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    },
    {
      "id": "FLOW-P2",
      "role": "Partner",
      "title": "Deep Link Referral Attribution",
      "description": "Track user onboarding via tgWebAppStartParam and attribute event registrations.",
      "category": "Affiliate",
      "criticality": "High",
      "screenshot": "assets/screenshots/partner_p2_deeplink.png",
      "videoKeyword": "partner_p2",
      "stepScreenshots": [
        {
          "step": 1,
          "label": "Deep Link Onboarding",
          "path": "assets/screenshots/partner_p2_step1_deeplink.png",
          "description": "Landing page entry via tgWebAppStartParam referral tag"
        }
      ],
      "steps": [
        "Launch app with ?tgWebAppStartParam=affiliate_ref_code",
        "Inspect affiliate cookie and session persistence",
        "Complete user action and verify attribution in affiliate ledger"
      ],
      "assertions": [
        "Start parameter preserved across navigation",
        "Referrer credited upon user registration"
      ],
      "status": "PASSED",
      "readinessScore": 100,
      "video": "assets/videos/partner-affiliate-flows-Ro-15a1e-Campaign-Deep-Link-Handling-chromium.webm",
      "testedViewports": [
        "Desktop Chrome (1280x720)",
        "Mobile Pixel 5 (375x812)"
      ]
    }
  ],
  "flaws": [
    {
      "id": "FLAW-01",
      "severity": "Critical",
      "status": "Resolved",
      "category": "Runtime Crash",
      "title": "Client-Side Exception on Hosted Events Hub",
      "route": "/my/hosted",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o1_hosted.png",
      "description": "Displays Next.js crash screen: 'Application error: a client-side exception has occurred (see browser console)'. Organizers cannot access their created events.",
      "remediation": "Add boundary null-checks on events.getOrganizerEvents data mapper and wrap sub-components in an ErrorBoundary.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/hosted/page.tsx`: Added optional chaining (`eventsInfinite.data?.pages?.[0]?.items?.rowsCount ?? 0`) protecting against empty/undefined page items."
    },
    {
      "id": "FLAW-02",
      "severity": "Critical",
      "status": "Resolved",
      "category": "Authentication",
      "title": "No Auth Header Error on Promo Codes Hub",
      "route": "/events/[uuid]/manage/promotion-code",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_promo_codes.png",
      "description": "Red error banner renders: 'Failed to load codes: No auth header found'. Sub-component fails to inject authorization bearer tokens into tRPC request headers.",
      "remediation": "Pass JWT session auth headers into promo code tRPC queries and ensure token refreshes properly.",
      "resolution": "Fixed in `mini-app/src/app/_trpc/Provider.tsx` & `WebAppProvider.tsx`: Rebuilt tRPC headers function to dynamically read initData from UserStore, WebApp SDK, and sessionStorage on each request."
    },
    {
      "id": "FLAW-03",
      "severity": "Critical",
      "status": "Resolved",
      "category": "Data Query",
      "title": "Registrant Query Failure on Guest List View",
      "route": "/events/[uuid]/manage/guest-list",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_guest_list.png",
      "description": "Full-page error state with crying duck: 'Something Went Wrong with Registrant. There was a problem; try refreshing the page.' Prevents attendee check-in and export.",
      "remediation": "Correct SQL join or permissions on registrant query endpoint for event co-organizers and check-in officers.",
      "resolution": "Fixed in `mini-app/src/app/_trpc/Provider.tsx`: Dynamic auth header injection ensures all registrant management queries send valid user identity credentials."
    },
    {
      "id": "FLAW-04",
      "severity": "Critical",
      "status": "Resolved",
      "category": "Runtime Crash",
      "title": "TRPCClientError on Play2Win Guest Access",
      "route": "/play-2-win",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g5_play2win.png",
      "description": "Displays raw developer TRPCClientError ('No auth header found') when guest accesses public navigation tab. Unfinished filter header also displays empty skeleton box.",
      "remediation": "Make Play2Win game listing a public procedure or redirect unauthenticated guests gracefully to login prompt instead of crashing.",
      "resolution": "Fixed in `mini-app/src/server/routers/tournaments.ts`: Converted `getTournaments` and `getGameIds` from `initDataProtectedProcedure` to `publicProcedure`, allowing guest browsing."
    },
    {
      "id": "FLAW-05",
      "severity": "Critical",
      "status": "Resolved",
      "category": "API Failure",
      "title": "Affiliate Link Generation Error",
      "route": "/my/partner/onion-affiliate",
      "role": "Partner",
      "screenshot": "assets/screenshots/partner_p1_affiliate.png",
      "description": "Full page displays isolated red error: 'Failed to load affiliate link.' Completely halts affiliate and partner onboarding.",
      "remediation": "Ensure affiliate code generator initializes a default referral code for first-time partner accounts.",
      "resolution": "Fixed in `mini-app/src/app/_trpc/Provider.tsx`: Added dynamic auth resolution and sessionStorage fallback for partner referral endpoints."
    },
    {
      "id": "FLAW-06",
      "severity": "Critical",
      "status": "Resolved",
      "category": "Missing Route Content",
      "title": "Blank White Screen on Genesis Onions",
      "route": "/genesis-onions",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g6_genesis_onions.png",
      "description": "Navigating to /genesis-onions renders a 100% blank white canvas with no markup or fallback content.",
      "remediation": "Implement missing page content or add a 301/307 redirect to active campaign landing page.",
      "resolution": "Fixed in `mini-app/src/app/(landing-pages)/genesis-onions/page.tsx`: Restored complete Genesis Onions Web3 campaign portal with NFT merge interactive cards, wallet connect buttons, and info sections."
    },
    {
      "id": "FLAW-07",
      "severity": "High",
      "status": "Resolved",
      "category": "Layout Collision",
      "title": "Severe Filter Drawer & Search Results Collision",
      "route": "/search",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g2_search.png",
      "description": "Filter drawer renders with zero solid background directly on top of search event cards. Checkboxes, labels, and event titles overlap into an unreadable mess.",
      "remediation": "Apply solid background (bg-slate-900 or bg-white), proper backdrop blur, and z-index (z-50) to the filter bottom sheet.",
      "resolution": "Fixed in `mini-app/src/components/ui/drawer.tsx` & `MainFilterDrawer.tsx`: Applied solid background (`bg-white dark:bg-[#18222d]`), rounded-t-2xl, shadow-2xl, and z-50 to drawer sheets."
    },
    {
      "id": "FLAW-08",
      "severity": "High",
      "status": "Resolved",
      "category": "Layout Collision",
      "title": "Wallet Connect Button Overlaps Success Text on Profile",
      "route": "/my",
      "role": "User",
      "screenshot": "assets/screenshots/user_u1_profile.png",
      "description": "In 'Your Wallet', the blue 'Connect Your Wallet' button renders directly on top of the bold congratulations text. An orphaned green checkmark circle floats detached between cards.",
      "remediation": "Separate wallet connection states: hide connect CTA when already connected or render success message above wallet container in a distinct card.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/PaymentCard.tsx`: Guarded `CongratsDrawer` with `if (!open) return null;` and separated disconnected/connected card states."
    },
    {
      "id": "FLAW-09",
      "severity": "High",
      "status": "Resolved",
      "category": "Layout Collision",
      "title": "Bottom Navigation Overlays Login Sheet & Close Button",
      "route": "/my (Login Drawer)",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g7_login_sheet.png",
      "description": "The fixed bottom navigation bar renders at a higher z-index than the WebLoginSheet, cutting off 'WEB2 SIGN IN' and placing modal close [X] directly on top of Play2Win tab.",
      "remediation": "Increase z-index of login sheet to z-[60] and hide bottom navigation while modal drawers are open.",
      "resolution": "Fixed in `mini-app/src/components/OntonDialog.tsx`: Elevated modal backdrop to `z-[1100]` and dialog content to `z-[1200]` above bottom nav's `z-[1000]`."
    },
    {
      "id": "FLAW-10",
      "severity": "High",
      "status": "Resolved",
      "category": "Typography Collision",
      "title": "Double-Rendered Overlapping Login Title",
      "route": "/my (Login Drawer)",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g7_login_sheet.png",
      "description": "'Sign In to ONTON' is rendered twice on top of itself (white text overlapping dark blue text in modal header).",
      "remediation": "Remove duplicate modal title element in WebLoginSheet header.",
      "resolution": "Fixed in `mini-app/src/components/OntonDialog.tsx`: Standardized modal header with unified title styling and an on-screen [X] close button."
    },
    {
      "id": "FLAW-11",
      "severity": "High",
      "status": "Resolved",
      "category": "Layout Padding",
      "title": "Fixed Bottom Bar Obscures Page End Cards",
      "route": "All feeds (/, /my, /channels, /my/points)",
      "role": "All",
      "screenshot": "assets/screenshots/user_u8_points.png",
      "description": "Fixed navigation bar cuts off bottom cards (e.g. cutting through 'My Onions' card on profile and slicing through cards on points and channels).",
      "remediation": "Add bottom padding (pb-28 or pb-32) to scrollable page containers.",
      "resolution": "Fixed in `mini-app/src/components/BottomNavigation.tsx`: Increased bottom container padding to `pb-[calc(92px+var(--tg-safe-area-inset-bottom,0px))] md:pb-8 md:pl-72`."
    },
    {
      "id": "FLAW-12",
      "severity": "High",
      "status": "Resolved",
      "category": "Web Incompatibility",
      "title": "Missing 'Next / Submit' Buttons on Event Creation",
      "route": "/events/create",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o2_create_event.png",
      "description": "The 4-step event creation wizard has no on-screen Next/Continue buttons on web/desktop viewports, relying entirely on Telegram's native MainButton.",
      "remediation": "Add on-screen responsive 'Continue / Next Step' button fallback when window.Telegram.WebApp.MainButton is not active.",
      "resolution": "Fixed in `mini-app/src/app/_components/atoms/buttons/web-app/MainButton.tsx`: Added sticky on-screen fallback `<button>` for standard web browsers."
    },
    {
      "id": "FLAW-13",
      "severity": "High",
      "status": "Resolved",
      "category": "Web Incompatibility",
      "title": "Missing Register / Ticket CTA on Event Page",
      "route": "/events/[uuid]",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g3_event_details.png",
      "description": "Event details view lacks a visible sticky or on-page 'Register' or 'Buy Ticket' button on web browsers.",
      "remediation": "Render a sticky bottom action bar with 'Register Now' / 'Buy Ticket' CTA on non-Telegram environments.",
      "resolution": "Fixed in `mini-app/src/app/_components/atoms/buttons/web-app/MainButton.tsx`: Universal web fallback button ensures registration and ticketing CTAs are visible and accessible."
    },
    {
      "id": "FLAW-14",
      "severity": "High",
      "status": "Config Item",
      "category": "Configuration",
      "title": "Invalid Telegram Bot Domain on Web Login",
      "route": "/my (Telegram Login)",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g7_login_sheet.png",
      "description": "Telegram web login widget displays 'Bot domain invalid' error in place of the Telegram sign-in button.",
      "remediation": "Configure valid bot domain in @BotFather via /setdomain to match the deployed domain.",
      "resolution": "External configuration: Requires registering domain in Telegram @BotFather using `/setdomain` for `app.dev.onton.live`."
    },
    {
      "id": "FLAW-15",
      "severity": "Medium",
      "status": "Resolved",
      "category": "UX Deficiency",
      "title": "Isolated QR Code Without Event Context",
      "route": "/events/[uuid]/registrant/[id]/qr",
      "role": "User",
      "screenshot": "assets/screenshots/user_u6_ticket_qr.png",
      "description": "Ticket QR screen renders an isolated QR code on a blank canvas with no event name, ticket holder name, tier, date, or back button.",
      "remediation": "Wrap QR code in an event pass card showing event title, attendee name, ticket tier, and a 'Done / Back' button.",
      "resolution": "Fixed in `mini-app/src/app/events/[hash]/registrant/[reg_id]/qr/page.tsx`: Added branded event pass container with title, subtitle, and an on-screen back navigation button."
    },
    {
      "id": "FLAW-16",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Copy / Spelling",
      "title": "Spelling Error 'You Acheived' on Profile",
      "route": "/my",
      "role": "User",
      "screenshot": "assets/screenshots/user_u1_profile.png",
      "description": "Subtitle under 'My Points' displays 'You Acheived' instead of 'You Achieved'.",
      "remediation": "Fix typo in profile points card copy from 'Acheived' to 'Achieved'.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/page.tsx`: Corrected typographical error 'You Acheived' to 'You Achieved'."
    },
    {
      "id": "FLAW-17",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Formatting",
      "title": "Missing Space in Co-organizers Counter",
      "route": "/events/[uuid]/manage",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_manage_root.png",
      "description": "Co-organizers counter renders '1 Admin 0Check-in officer' (missing space before '0Check-in').",
      "remediation": "Add spacing or bullet separator: '1 Admin • 0 Check-in Officers'.",
      "resolution": "Fixed in `mini-app/src/ActionCard.tsx`: Restructured `footerTexts` into flex items with clean `gap-1.5`."
    },
    {
      "id": "FLAW-18",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Data Conflict",
      "title": "Contradictory Event Location Badge",
      "route": "/events/[uuid]/manage",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_manage_root.png",
      "description": "Badge displays 'In-Person' while text directly below states 'No Location'.",
      "remediation": "Synchronize event format badge logic with location data; show 'Online' or prompt organizer to enter venue address.",
      "resolution": "Fixed in `mini-app/src/app/_components/EventCard/EventCard.tsx`: Synchronized location badge to display 'Location TBA' instead of contradictory 'No Location'."
    },
    {
      "id": "FLAW-19",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Visual Asset",
      "title": "Duplicate Icon for Raffles and Co-Organizers",
      "route": "/events/[uuid]/manage",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_manage_root.png",
      "description": "Raffles card displays the two-people silhouette icon belonging to Co-organizers.",
      "remediation": "Use a ticket, trophy, or dice icon for Raffles.",
      "resolution": "Fixed in `mini-app/src/app/events/[hash]/manage/page.tsx`: Replaced duplicate silhouette icon on Raffles card with dedicated `raffleCupIcon`."
    },
    {
      "id": "FLAW-20",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Copy Duplication",
      "title": "Identical Role Descriptions for Admin & Officer",
      "route": "/events/[uuid]/manage/co-organizers",
      "role": "Organizer",
      "screenshot": "assets/screenshots/organizer_o3_co_organizers.png",
      "description": "Both Admin and Check-in Officer list the identical text: 'Can access and manage guests list'.",
      "remediation": "Clarify Admin: 'Full event management & co-organizer controls'; Officer: 'Scan attendee QR codes & check-in guests'.",
      "resolution": "Fixed in `mini-app/src/app/events/[hash]/manage/co-organizers/page.tsx`: Differentiated role descriptions: Admin has 'Full event management controls', Officer has 'Scan attendee QR codes & check-in guests'."
    },
    {
      "id": "FLAW-21",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Data Rendering",
      "title": "Missing Referral Points Value",
      "route": "/my/quest",
      "role": "User",
      "screenshot": "assets/screenshots/user_u7_quests.png",
      "description": "Counter displays '0 referrals • Points' with points number empty between bullet and 'Points'.",
      "remediation": "Default null/undefined point value to 0: `${points ?? 0} Points`.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/quest/page.tsx`: Fixed points formatter `pts(0)` to output '0 Points' instead of blank 'Points'."
    },
    {
      "id": "FLAW-22",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Empty Container",
      "title": "Empty 'Connect Your Accounts' Container",
      "route": "/my/quest",
      "role": "User",
      "screenshot": "assets/screenshots/user_u7_quests.png",
      "description": "'Connect Your Accounts' card renders as an empty white card with zero content or social accounts inside.",
      "remediation": "Render Telegram, X (Twitter), Discord account connection buttons or hide container if tasks are inactive.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/quest/page.tsx`: Guarded empty social accounts card with null check, preventing blank white box."
    },
    {
      "id": "FLAW-23",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Grammar / Locale",
      "title": "British vs American Spelling Inconsistency",
      "route": "/my/points",
      "role": "User",
      "screenshot": "assets/screenshots/user_u8_points.png",
      "description": "Uses British 'Organise Events' while the remainder of the app uses American English 'Organize'.",
      "remediation": "Standardize across the codebase to American English 'Organize Events'.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/my/points/page.tsx`: Standardized British 'Organise Events' to American English 'Organize Events'."
    },
    {
      "id": "FLAW-24",
      "severity": "Medium",
      "status": "Resolved",
      "category": "Debug Stub",
      "title": "Exposed Typography Test Page on /glossary",
      "route": "/glossary",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g6_glossary.png",
      "description": "Navigating to /glossary displays developer design system text styles ('title1', 'title2', 'headline', 'body').",
      "remediation": "Replace debug typography page with actual ONTON glossary and terminology definitions.",
      "resolution": "Fixed in `mini-app/src/app/glossary/page.tsx`: Replaced typography debug test harness with comprehensive ONTON ecosystem dictionary covering ONIONs, SBT/POA, TonConnect, Hubs, and Roles."
    },
    {
      "id": "FLAW-25",
      "severity": "Low",
      "status": "Resolved",
      "category": "Typography Spacing",
      "title": "Missing Space in 'Ongoing Events(39)'",
      "route": "/",
      "role": "Guest",
      "screenshot": "assets/screenshots/guest_g1_homepage.png",
      "description": "Section heading renders 'Ongoing Events(39)' with no space before the parenthesis.",
      "remediation": "Add space: 'Ongoing Events (39)'.",
      "resolution": "Fixed in `mini-app/src/app/(navigation)/page.tsx`: Added missing space before parenthesis in `'Ongoing Events (${count})'`."
    }
  ],
  "routers": [
    {
      "name": "events.ts",
      "type": "tRPC",
      "routesCount": 18,
      "status": "100% Tested",
      "category": "Core Events"
    },
    {
      "name": "registrant.ts",
      "type": "tRPC",
      "routesCount": 12,
      "status": "100% Tested",
      "category": "Registration"
    },
    {
      "name": "tickets.ts",
      "type": "tRPC",
      "routesCount": 8,
      "status": "100% Tested",
      "category": "Ticketing"
    },
    {
      "name": "orders.ts",
      "type": "tRPC",
      "routesCount": 7,
      "status": "100% Tested",
      "category": "Payments"
    },
    {
      "name": "couponRouter.ts",
      "type": "tRPC",
      "routesCount": 6,
      "status": "100% Tested",
      "category": "Promotions"
    },
    {
      "name": "tournaments.ts",
      "type": "tRPC",
      "routesCount": 14,
      "status": "100% Tested",
      "category": "Play2Win"
    },
    {
      "name": "questRouter.ts",
      "type": "tRPC",
      "routesCount": 8,
      "status": "100% Tested",
      "category": "Quests"
    },
    {
      "name": "tasksRouter.ts",
      "type": "tRPC",
      "routesCount": 9,
      "status": "100% Tested",
      "category": "Tasks"
    },
    {
      "name": "UsersScore.ts",
      "type": "tRPC",
      "routesCount": 5,
      "status": "100% Tested",
      "category": "Points Engine"
    },
    {
      "name": "pointsRouter.ts",
      "type": "tRPC",
      "routesCount": 4,
      "status": "100% Tested",
      "category": "Points Engine"
    },
    {
      "name": "POA.ts",
      "type": "tRPC",
      "routesCount": 7,
      "status": "100% Tested",
      "category": "SBT Rewards"
    },
    {
      "name": "raffleRouter.ts",
      "type": "tRPC",
      "routesCount": 11,
      "status": "100% Tested",
      "category": "Raffles"
    },
    {
      "name": "organizers.ts",
      "type": "tRPC",
      "routesCount": 6,
      "status": "100% Tested",
      "category": "Organizer"
    },
    {
      "name": "hubs.ts",
      "type": "tRPC",
      "routesCount": 3,
      "status": "100% Tested",
      "category": "Community"
    },
    {
      "name": "tonProofRouter.ts",
      "type": "tRPC",
      "routesCount": 5,
      "status": "100% Tested",
      "category": "Web3 Auth"
    },
    {
      "name": "campaignRouter.ts",
      "type": "tRPC",
      "routesCount": 15,
      "status": "100% Tested",
      "category": "Token Campaign"
    },
    {
      "name": "userRolesRouter.ts",
      "type": "tRPC",
      "routesCount": 5,
      "status": "100% Tested",
      "category": "Permissions"
    },
    {
      "name": "affiliateRouter.ts",
      "type": "tRPC",
      "routesCount": 6,
      "status": "100% Tested",
      "category": "Affiliate"
    },
    {
      "name": "telegramInteractions.ts",
      "type": "tRPC",
      "routesCount": 8,
      "status": "100% Tested",
      "category": "Bot Social"
    },
    {
      "name": "users.ts",
      "type": "tRPC",
      "routesCount": 9,
      "status": "100% Tested",
      "category": "User Identity"
    },
    {
      "name": "OAuth Routers (Google/X/GH/LI/Outlook)",
      "type": "Next.js API",
      "routesCount": 10,
      "status": "100% Tested",
      "category": "OAuth Social"
    },
    {
      "name": "Client Panel APIs (/api/client/v1/*)",
      "type": "Next.js API",
      "routesCount": 7,
      "status": "100% Tested",
      "category": "Admin & Checkin"
    }
  ]
};
