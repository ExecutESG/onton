const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'generate-portal-data.js');
const content = fs.readFileSync(targetFile, 'utf8');

const flowsCatalog = [
  // ROLE 1: GUEST PERSONA
  {
    id: "FLOW-G1",
    role: "Guest",
    title: "Homepage Feed & Promoted Discovery",
    description: "Browse featured banners, contests, ongoing events, and responsive navigation.",
    category: "Discovery",
    criticality: "High",
    screenshot: "assets/screenshots/guest_g1_homepage.png",
    videoKeyword: "guest_g1",
    stepScreenshots: [
      { step: 1, label: "Hero Banner & Search", path: "assets/screenshots/guest_g1_step1_hero.png", description: "Top viewport showing search bar and featured event banner" },
      { step: 2, label: "Category Quick-Pills", path: "assets/screenshots/guest_g1_step2_categories.png", description: "Event category quick-pills (All, Online, In-person)" },
      { step: 3, label: "Featured Events Carousel", path: "assets/screenshots/guest_g1_step3_featured.png", description: "Promoted and sponsored ecosystem event cards" },
      { step: 4, label: "Ongoing Events Feed", path: "assets/screenshots/guest_g1_step4_ongoing.png", description: "Active online and in-person events feed" },
      { step: 5, label: "Feed Pagination & Footer", path: "assets/screenshots/guest_g1_step5_scroll_bottom.png", description: "Bottom feed with pagination and show more" },
      { step: 6, label: "Bottom Navigation Bar", path: "assets/screenshots/guest_g1_step6_navigation.png", description: "Responsive navigation tabs (Events, Channels, Play2Win, Login)" }
    ],
    steps: [
      "Navigate to https://app.dev.onton.live/",
      "Verify search bar and filter quick-actions",
      "Verify Featured Events banner carousel",
      "Verify Featured Contests / Ongoing Events feed",
      "Verify responsive bottom navigation (mobile) / sidebar (desktop)"
    ],
    assertions: [
      "Document title contains 'ONTON'",
      "Search bar is visible and interactive",
      "Featured Events section is rendered",
      "Navigation elements render correctly for viewport"
    ]
  },
  {
    id: "FLOW-G2",
    role: "Guest",
    title: "Global Search & Category Filtering",
    description: "Multi-parameter search by title, tags, date, and price category.",
    category: "Discovery",
    criticality: "High",
    screenshot: "assets/screenshots/guest_g2_search.png",
    videoKeyword: "guest_g2",
    stepScreenshots: [
      { step: 1, label: "Initial Search Feed", path: "assets/screenshots/guest_g2_step1_initial.png", description: "Default search feed and category filters" },
      { step: 2, label: "Keyword Input 'Finance'", path: "assets/screenshots/guest_g2_step2_query.png", description: "Real-time debounced query input" },
      { step: 3, label: "Filter Drawer: Event Type", path: "assets/screenshots/guest_g2_step3_filter_drawer_open.png", description: "Filter drawer opened: All, In-Person, Online" },
      { step: 4, label: "Filter Drawer: TON Hubs", path: "assets/screenshots/guest_g2_step4_filter_hubs.png", description: "Scroll to select regional TON hubs" },
      { step: 5, label: "Filter Drawer: Sort By", path: "assets/screenshots/guest_g2_step5_filter_sort.png", description: "Sort by Date, Popularity, or Relevance" },
      { step: 6, label: "Tapping Apply Filters", path: "assets/screenshots/guest_g2_step6_apply_filter.png", description: "Apply filters button with badge counter" },
      { step: 7, label: "Clean Filtered Results", path: "assets/screenshots/guest_g2_step7_clean_results.png", description: "Search matches with pricing and location badges" }
    ],
    steps: [
      "Navigate to /search",
      "Input search query 'Finance'",
      "Open filter drawer and select event type and TON Hub",
      "Apply filters and inspect targeted event cards"
    ],
    assertions: [
      "Search input reacts to user keystrokes",
      "Filter drawer opens and closes without backdrop overlay bugs",
      "Filtered results accurately match criteria"
    ]
  },
  {
    id: "FLOW-G3",
    role: "Guest",
    title: "Event Details & Ticketing Options",
    description: "Detailed event inspection with host organizer bio, venue, and ticket tiers.",
    category: "Events",
    criticality: "Critical",
    screenshot: "assets/screenshots/guest_g3_event_details.png",
    videoKeyword: "guest_g3",
    stepScreenshots: [
      { step: 1, label: "Event Hero & Title", path: "assets/screenshots/guest_g3_step1_hero.png", description: "Cover artwork and event title banner" },
      { step: 2, label: "Date, Time & Badges", path: "assets/screenshots/guest_g3_step2_details.png", description: "Event schedule, venue details, and status badges" },
      { step: 3, label: "Pricing Tier Badge", path: "assets/screenshots/guest_g3_step3_pricing_tier.png", description: "Free vs Paid ticket tiers and pricing breakdown" },
      { step: 4, label: "Description & Agenda", path: "assets/screenshots/guest_g3_step4_about.png", description: "Comprehensive markdown description, timeline, and topics" },
      { step: 5, label: "Organizer Profile Card", path: "assets/screenshots/guest_g3_step5_organizer_cta.png", description: "Verified organizer credentials, follower count, and bio" },
      { step: 6, label: "Sticky Register CTA", path: "assets/screenshots/guest_g3_step6_sticky_rsvp.png", description: "Persistent bottom CTA bar with Register button" }
    ],
    steps: [
      "Navigate to /events/[hash]",
      "Inspect hero banner, schedule, and venue badges",
      "Review pricing tier breakdown and description",
      "Inspect organizer profile card and action CTA"
    ],
    assertions: [
      "Event banner image renders from MinIO CDN",
      "Organizer name and avatar visible",
      "Ticket pricing options displayed clearly",
      "Sticky action bar remains accessible on scroll"
    ]
  },
  {
    id: "FLOW-G4",
    role: "Guest",
    title: "Organizer Channels Discovery",
    description: "Browse verified organizer channels, community hubs, and hosted portfolios.",
    category: "Community",
    criticality: "Medium",
    screenshot: "assets/screenshots/guest_g4_channels.png",
    videoKeyword: "guest_g4",
    stepScreenshots: [
      { step: 1, label: "Channels Feed Header", path: "assets/screenshots/guest_g4_step1_top.png", description: "Top verified channels and community hubs directory" },
      { step: 2, label: "Channel Directory Cards", path: "assets/screenshots/guest_g4_step2_scrolled.png", description: "Directory cards with channel avatars and event counts" },
      { step: 3, label: "Verified Channels Grid", path: "assets/screenshots/guest_g4_step2_channel_cards.png", description: "Grid view of verified organizer channels" },
      { step: 4, label: "Channel Profile View", path: "assets/screenshots/guest_g4_step3_channel_detail.png", description: "Channel detail screen with hosted portfolio" },
      { step: 5, label: "Join Telegram Channel", path: "assets/screenshots/guest_g4_step4_telegram_link.png", description: "External Telegram channel community link" },
      { step: 6, label: "Channel Hosted Feed", path: "assets/screenshots/guest_g4_step5_community_feed.png", description: "Past and upcoming events hosted by this channel" }
    ],
    steps: [
      "Navigate to /channels",
      "Inspect organizer channel cards and verified badges",
      "Navigate into channel profile /channels/[id]",
      "Inspect hosted portfolio and Telegram join button"
    ],
    assertions: [
      "Channels directory loads successfully without auth error",
      "Channel cards display title, bio, and hosted event counts"
    ]
  },
  {
    id: "FLOW-G5",
    role: "Guest",
    title: "Play2Win Tournaments & Global Leaderboard",
    description: "Explore competitive gaming contests, rules, prize pools, and rankings.",
    category: "Gaming",
    criticality: "High",
    screenshot: "assets/screenshots/guest_g5_play2win.png",
    videoKeyword: "guest_g5",
    stepScreenshots: [
      { step: 1, label: "Play2Win Discover Header", path: "assets/screenshots/guest_g5_step1_header.png", description: "Tournament categories, active contests, and time filters" },
      { step: 2, label: "Tournament Arena View", path: "assets/screenshots/guest_g5_step2_games.png", description: "Active tournament cards with prize pool breakdown" },
      { step: 3, label: "Featured Competitions", path: "assets/screenshots/guest_g5_step2_active_tournaments.png", description: "Featured competitions and partner gaming titles" },
      { step: 4, label: "Rules & Scoring System", path: "assets/screenshots/guest_g5_step3_rules.png", description: "Point scoring rules, entry requirements, and rewards" },
      { step: 5, label: "Global Leaderboard", path: "assets/screenshots/guest_g5_step4_leaderboard.png", description: "Rankings table showing top players, scores, and rewards" },
      { step: 6, label: "Join Tournament CTA", path: "assets/screenshots/guest_g5_step5_join_cta.png", description: "Entry confirmation and contest registration button" }
    ],
    steps: [
      "Navigate to /play-2-win",
      "Verify public access without TRPCClientError",
      "Inspect active tournaments and prize pools",
      "Inspect leaderboard and contest scoring rules"
    ],
    assertions: [
      "Public procedures getTournaments and getGameIds succeed without initData",
      "Tournament cards display game art and prize pool",
      "Leaderboard rankings render accurately"
    ]
  },
  {
    id: "FLOW-G6",
    role: "Guest",
    title: "Growth & Ecosystem Landing Pages",
    description: "Explore Genesis Onions, Onion Snapshot, Airdrop, and Glossary pages.",
    category: "Marketing",
    criticality: "High",
    screenshot: "assets/screenshots/guest_g6_onion_snapshot.png",
    videoKeyword: "guest_g6",
    stepScreenshots: [
      { step: 1, label: "Onion Snapshot Breakdown", path: "assets/screenshots/guest_g6_step1_snapshot.png", description: "Community allocation breakdown and snapshot timer" },
      { step: 2, label: "Genesis Onions NFT Tier", path: "assets/screenshots/guest_g6_step2_genesis_onions.png", description: "Genesis NFT collection details and multiplier tiers" },
      { step: 3, label: "Airdrop Calculation Rules", path: "assets/screenshots/guest_g6_step3_airdrop_rules.png", description: "Transparent scoring criteria for community airdrop" },
      { step: 4, label: "Ecosystem Glossary & FAQ", path: "assets/screenshots/guest_g6_step4_faq_glossary.png", description: "Frequently asked questions and ecosystem terms" },
      { step: 5, label: "Official Telegram Links", path: "assets/screenshots/guest_g6_step5_community_links.png", description: "Official community chat, announcements, and socials" }
    ],
    steps: [
      "Navigate to /onion-snapshot",
      "Inspect allocation progress and Genesis Onions preview",
      "Navigate to /genesis-onions and verify no white canvas crash",
      "Review glossary definitions and community links"
    ],
    assertions: [
      "All landing pages render fully formatted content",
      "No 404 or blank canvas bugs on marketing routes"
    ]
  },
  {
    id: "FLOW-G7",
    role: "Guest",
    title: "Gated Actions & WebLoginSheet Trigger",
    description: "Triggering authentication sheet when performing restricted actions as guest.",
    category: "Identity",
    criticality: "Critical",
    screenshot: "assets/screenshots/guest_g7_login_sheet.png",
    videoKeyword: "guest_g7",
    stepScreenshots: [
      { step: 1, label: "Gated Action Trigger", path: "assets/screenshots/guest_g7_step1_gated.png", description: "Guest attempts restricted action requiring authentication" },
      { step: 2, label: "WebLoginSheet Opened", path: "assets/screenshots/guest_g7_step2_login_sheet.png", description: "Responsive bottom sheet with authentication options" },
      { step: 3, label: "Telegram Login Option", path: "assets/screenshots/guest_g7_step3_telegram_option.png", description: "One-tap Telegram Mini App seamless login" },
      { step: 4, label: "TON Connect Wallets", path: "assets/screenshots/guest_g7_step4_web3.png", description: "Tonkeeper, Telegram Wallet, and Tonhub connection list" },
      { step: 5, label: "Web3 Providers Grid", path: "assets/screenshots/guest_g7_step3_web3.png", description: "Decentralized wallet sign-in provider grid" },
      { step: 6, label: "Security Terms & Privacy", path: "assets/screenshots/guest_g7_step5_security_terms.png", description: "Privacy agreement and terms of service link" }
    ],
    steps: [
      "Tap 'Register' or 'Join' on an event without active session",
      "Verify WebLoginSheet bottom sheet transitions into viewport",
      "Inspect Telegram login button and TON Connect wallet options",
      "Verify security terms and dismiss interaction"
    ],
    assertions: [
      "Login sheet displays both Web2 and Web3 providers",
      "Backdrop overlay is interactive and responsive"
    ]
  },

  // ROLE 2: AUTHENTICATED ATTENDEE PERSONA
  {
    id: "FLOW-U1",
    role: "User",
    title: "TMA Authenticated Session & Profile Hub",
    description: "User profile hub, points summary, activity metrics, and digital ticket passes.",
    category: "Identity",
    criticality: "Critical",
    screenshot: "assets/screenshots/user_u1_profile.png",
    videoKeyword: "user_u1",
    stepScreenshots: [
      { step: 1, label: "Profile Header @Mfarimani", path: "assets/screenshots/user_u1_step1_profile_header.png", description: "User profile header showing avatar, username, and verified status" },
      { step: 2, label: "ONION Points Summary", path: "assets/screenshots/user_u1_step2_points_summary.png", description: "Real-time ONION points balance and ranking badge" },
      { step: 3, label: "Activity Summary Statistics", path: "assets/screenshots/user_u1_step2_activities.png", description: "Registered events, attended events, and quest counts" },
      { step: 4, label: "Participation Breakdown", path: "assets/screenshots/user_u1_step3_activity_stats.png", description: "Detailed event participation history and completion rates" },
      { step: 5, label: "Quests & Points Shortcuts", path: "assets/screenshots/user_u1_step3_quests_points.png", description: "Quick access to active quests and reward claiming" },
      { step: 6, label: "Registered Ticket Passes", path: "assets/screenshots/user_u1_step4_recent_tickets.png", description: "Active digital ticket passes with quick QR access" },
      { step: 7, label: "Connected TON Wallet", path: "assets/screenshots/user_u1_step5_wallet_status.png", description: "TON Connect wallet address and network status" },
      { step: 8, label: "Settings & Support Hub", path: "assets/screenshots/user_u1_step6_navigation_hub.png", description: "Account settings, notifications, language, and support links" }
    ],
    steps: [
      "Authenticate via Telegram initData mock",
      "Navigate to /my profile hub",
      "Verify user details (@Mfarimani, photo, points)",
      "Inspect registered ticket passes and connected wallet"
    ],
    assertions: [
      "User session initialized via users.syncUser",
      "Points ledger loaded via UsersScore.getTotalScoreByUserId",
      "Wallet address correctly formatted"
    ]
  },
  {
    id: "FLOW-U2",
    role: "User",
    title: "Free Event RSVP & Attendee Questionnaire",
    description: "One-click registration for free community events with custom organizer questions.",
    category: "Registration",
    criticality: "Critical",
    screenshot: "assets/screenshots/user_u2_rsvp.png",
    videoKeyword: "user_u2",
    stepScreenshots: [
      { step: 1, label: "Authenticated Event View", path: "assets/screenshots/user_u2_step1_event_view.png", description: "Event page loaded with authenticated user credentials" },
      { step: 2, label: "Ticket Tier Selection", path: "assets/screenshots/user_u2_step2_tier_selection.png", description: "Selection of free admission ticket tier" },
      { step: 3, label: "Registration Questionnaire", path: "assets/screenshots/user_u2_step3_questionnaire.png", description: "Custom questionnaire required by organizer (role, company)" },
      { step: 4, label: "Review Order Summary", path: "assets/screenshots/user_u2_step4_review_order.png", description: "Order summary review with attendee contact confirmation" },
      { step: 5, label: "Confirm Registration Click", path: "assets/screenshots/user_u2_step5_confirm_click.png", description: "Tapping CONFIRM REGISTRATION with instantaneous feedback" },
      { step: 6, label: "Success Confirmation Toast", path: "assets/screenshots/user_u2_step6_success_confirmation.png", description: "Registration confirmed dialog with ticket pass link" }
    ],
    steps: [
      "Open event page as authenticated attendee",
      "Select Free Registration ticket tier",
      "Fill organizer questionnaire fields",
      "Review order summary and tap Confirm Registration",
      "Receive registration confirmation and digital pass"
    ],
    assertions: [
      "RSVP mutation registrant.registerEvent executes successfully",
      "Questionnaire responses saved in database",
      "Ticket pass generated with unique QR code"
    ]
  },
  {
    id: "FLOW-U3",
    role: "User",
    title: "Paid Ticket & Order Checkout Systems",
    description: "End-to-end checkout with TON cryptocurrency, TonConnect wallet, and Stars.",
    category: "Payments",
    criticality: "Critical",
    screenshot: "assets/screenshots/user_u3_paid_checkout.png",
    videoKeyword: "user_u3",
    stepScreenshots: [
      { step: 1, label: "Event Overview & Paid Tier", path: "assets/screenshots/user_u3_step1_event_overview.png", description: "Event overview highlighting VIP and standard paid ticket tiers" },
      { step: 2, label: "Paid Ticket Tier Details", path: "assets/screenshots/user_u3_step1_paid_tier.png", description: "Tier perks, seat allotment, and pricing breakdown" },
      { step: 3, label: "Quantity Selector", path: "assets/screenshots/user_u3_step2_quantity_select.png", description: "Interactive quantity incrementer and price multiplier" },
      { step: 4, label: "Coupon Code Input", path: "assets/screenshots/user_u3_step3_coupon_input.png", description: "Promotional discount entry with real-time validation" },
      { step: 5, label: "Discount Calculation", path: "assets/screenshots/user_u3_step4_discount_applied.png", description: "Itemized subtotal showing applied promotional reduction" },
      { step: 6, label: "Payment Method Selection", path: "assets/screenshots/user_u3_step5_payment_method.png", description: "Payment channel selection (TON Connect, Telegram Stars)" },
      { step: 7, label: "Wallet Transaction Signing", path: "assets/screenshots/user_u3_step6_wallet_signing.png", description: "Tonkeeper wallet signing payload modal" },
      { step: 8, label: "Order Completed & Receipt", path: "assets/screenshots/user_u3_step7_order_completed.png", description: "Receipt confirmation with transaction hash and pass link" }
    ],
    steps: [
      "Select Paid VIP Ticket tier on event screen",
      "Specify ticket quantity and review subtotal",
      "Enter optional coupon code for discount",
      "Initiate TonConnect transaction dispatch",
      "Verify transaction confirmation and ticket issuance"
    ],
    assertions: [
      "Order created via orders.createOrder",
      "TonConnect payload contains correct recipient address and amount",
      "Receipt generated with blockchain transaction link"
    ]
  },
  {
    id: "FLOW-U4",
    role: "User",
    title: "Custom Registration Form Submission",
    description: "Complex questionnaire handling with text fields, dropdowns, and checkboxes.",
    category: "Registration",
    criticality: "High",
    screenshot: "assets/screenshots/user_u4_form_submission.png",
    videoKeyword: "user_u4",
    stepScreenshots: [
      { step: 1, label: "Form Introduction & Rules", path: "assets/screenshots/user_u4_step1_form_intro.png", description: "Organizer instructions and questionnaire guidelines" },
      { step: 2, label: "Text Inputs & Background", path: "assets/screenshots/user_u4_step2_text_inputs.png", description: "Candidate background and professional affiliation inputs" },
      { step: 3, label: "Dropdown Selections", path: "assets/screenshots/user_u4_step3_dropdown_select.png", description: "Experience level and track preference dropdown menus" },
      { step: 4, label: "Checkboxes & Consents", path: "assets/screenshots/user_u4_step4_checkboxes.png", description: "Terms of service, media consent, and code of conduct checks" },
      { step: 5, label: "Submission Success State", path: "assets/screenshots/user_u4_step5_submission_success.png", description: "Confirmation screen notifying user of application review" }
    ],
    steps: [
      "Open custom form required for curated event",
      "Fill text inputs, select dropdown options, and toggle consents",
      "Verify client validation highlights missing required fields",
      "Submit application and receive pending review confirmation"
    ],
    assertions: [
      "Client validation prevents empty submission of required fields",
      "Responses correctly serialized in registrant_info JSON column"
    ]
  },
  {
    id: "FLOW-U5",
    role: "User",
    title: "Coupon & Promo Code Discount Engine",
    description: "Validation, percentage/fixed discounts, expiration checks, and order deduction.",
    category: "Promotions",
    criticality: "High",
    screenshot: "assets/screenshots/user_u5_promo_code.png",
    videoKeyword: "user_u5",
    stepScreenshots: [
      { step: 1, label: "Promo Code Entry Field", path: "assets/screenshots/user_u5_step1_coupon_field.png", description: "Checkout sheet with Promo Code input and Apply button" },
      { step: 2, label: "Code Typing State", path: "assets/screenshots/user_u5_step2_code_typing.png", description: "Typing promotional code into discount field" },
      { step: 3, label: "Validation Spinner", path: "assets/screenshots/user_u5_step3_validation_spinner.png", description: "Real-time backend validation against couponRouter.ts" },
      { step: 4, label: "Success & Deducted Total", path: "assets/screenshots/user_u5_step4_success_state.png", description: "Discount applied and deducted from order balance" },
      { step: 5, label: "Error Handling & Limits", path: "assets/screenshots/user_u5_step5_error_handling.png", description: "Graceful error toast for expired or maxed-out coupons" }
    ],
    steps: [
      "Input promo code during checkout",
      "Validate code against coupon.validateCoupon API",
      "Inspect subtotal deduction",
      "Test invalid or expired code rejection"
    ],
    assertions: [
      "Valid coupon accurately reduces order total",
      "Usage count counter increments on order completion",
      "Expired coupons return friendly error message"
    ]
  },
  {
    id: "FLOW-U6",
    role: "User",
    title: "Attendee Digital Ticket Pass & Offline QR View",
    description: "Dynamic QR pass rendering, holographic badges, and offline cache storage.",
    category: "Ticketing",
    criticality: "Critical",
    screenshot: "assets/screenshots/user_u6_ticket_qr.png",
    videoKeyword: "user_u6",
    stepScreenshots: [
      { step: 1, label: "Digital Pass Card Hero", path: "assets/screenshots/user_u6_step1_pass_card.png", description: "High-resolution digital ticket pass with event artwork" },
      { step: 2, label: "Dynamic Ticket QR Code", path: "assets/screenshots/user_u6_step2_ticket_qr.png", description: "Dynamic cryptographic QR code for entry validation" },
      { step: 3, label: "Attendee Identity Metadata", path: "assets/screenshots/user_u6_step3_attendee_meta.png", description: "Attendee name, unique ticket ID, and admission tier" },
      { step: 4, label: "Live Ticket Status Badge", path: "assets/screenshots/user_u6_step4_ticket_status.png", description: "Real-time admission status (Valid / Checked In / Expired)" },
      { step: 5, label: "Pass Actions & Calendar", path: "assets/screenshots/user_u6_step5_actions.png", description: "Calendar sync, download pass, and share with friends" },
      { step: 6, label: "Offline Service Worker Cache", path: "assets/screenshots/user_u6_step6_offline_cache.png", description: "Pass cached for venue access even without network signal" }
    ],
    steps: [
      "Open ticket pass from profile or confirmation modal",
      "Inspect dynamic QR code rendering",
      "Verify attendee identity and ticket tier metadata",
      "Verify pass remains accessible when offline"
    ],
    assertions: [
      "QR payload contains verifiable cryptographic signature",
      "Ticket status reflects real-time database state",
      "Service worker caches pass assets locally"
    ]
  },
  {
    id: "FLOW-U7",
    role: "User",
    title: "Quests & Social Tasks Engine",
    description: "Daily check-ins, social missions, verification loops, and instant points credit.",
    category: "Engagement",
    criticality: "High",
    screenshot: "assets/screenshots/user_u7_quests.png",
    videoKeyword: "user_u7",
    stepScreenshots: [
      { step: 1, label: "Quests Hub Header", path: "assets/screenshots/user_u7_step1_points_header.png", description: "Active social and on-chain quests with ONION points rewards" },
      { step: 2, label: "Daily Check-in Streak", path: "assets/screenshots/user_u7_step2_daily_checkin.png", description: "Consecutive daily check-in tracker with streak multipliers" },
      { step: 3, label: "Referral Mission Card", path: "assets/screenshots/user_u7_step2_referral_tasks.png", description: "Invite 3 colleagues to unlock exclusive community badge" },
      { step: 4, label: "Social Follow Tasks", path: "assets/screenshots/user_u7_step3_social_tasks.png", description: "Telegram and X (Twitter) community tasks" },
      { step: 5, label: "Verifying State", path: "assets/screenshots/user_u7_step4_verifying_state.png", description: "Automated verification loop validating membership via bot" },
      { step: 6, label: "Task Completed Celebration", path: "assets/screenshots/user_u7_step5_task_completed.png", description: "Task completed celebration with glowing points credit" },
      { step: 7, label: "Referral Quest Progress", path: "assets/screenshots/user_u7_step6_referral_quest.png", description: "Referral tracker showing validated conversions" }
    ],
    steps: [
      "Navigate to /quests",
      "Complete Daily Check-in and claim streak reward",
      "Perform social follow task and tap Verify",
      "Verify instant ONION points credit and ledger update"
    ],
    assertions: [
      "Quest verification triggers tasksRouter.verifyTask",
      "Points ledger immediately reflects new credit balance"
    ]
  },
  {
    id: "FLOW-U8",
    role: "User",
    title: "ONION Points Engine & Tier Ranking",
    description: "Detailed transaction history, tier progression, multipliers, and redemption.",
    category: "Gamification",
    criticality: "High",
    screenshot: "assets/screenshots/user_u8_points.png",
    videoKeyword: "user_u8",
    stepScreenshots: [
      { step: 1, label: "Points Ledger & Balance", path: "assets/screenshots/user_u8_step1_balance.png", description: "Comprehensive points balance and recent transaction history" },
      { step: 2, label: "Tier Progress Bar", path: "assets/screenshots/user_u8_step2_tier_progress.png", description: "Progress toward next tier (Silver -> Gold -> Diamond)" },
      { step: 3, label: "Online Events Earnings", path: "assets/screenshots/user_u8_step2_online_events.png", description: "Points earned from virtual event attendances" },
      { step: 4, label: "In-Person Rewards Ledger", path: "assets/screenshots/user_u8_step3_inperson_rewards.png", description: "Premium points earned from verified in-person check-ins" },
      { step: 5, label: "Historical Points Stream", path: "assets/screenshots/user_u8_step3_history_list.png", description: "Complete chronologically ordered earning ledger" },
      { step: 6, label: "Global Leaderboard Rank", path: "assets/screenshots/user_u8_step6_leaderboard_rank.png", description: "Platform-wide leaderboard showing rank #42 among 10k users" }
    ],
    steps: [
      "Navigate to /my/points",
      "Inspect current points balance and tier ranking",
      "Review transaction breakdown by event type",
      "Verify global leaderboard rank"
    ],
    assertions: [
      "Points history loaded via pointsRouter.getUserPointsHistory",
      "Tier progression accurately calculated from total lifetime points"
    ]
  },

  // ROLE 3: ORGANIZER PERSONA
  {
    id: "FLOW-ONB",
    role: "Organizer",
    title: "New Organizer Onboarding & Channel Setup",
    description: "Step-by-step onboarding: wallet connection, 1.00 TON activation fee, channel customization, and + FAB launcher.",
    category: "Onboarding",
    criticality: "Critical",
    screenshot: "assets/screenshots/organizer_onb_cover.png",
    videoKeyword: "organizer_onb",
    stepScreenshots: [
      { step: 1, label: "Early Organizer Access Banner", path: "assets/screenshots/organizer_onb_step1_profile_intro.png", description: "Profile view with step 1: Connect your wallet prompt" },
      { step: 2, label: "Connect TON Wallet", path: "assets/screenshots/organizer_onb_step2_wallet_connected.png", description: "TON Connect wallet integration with active address" },
      { step: 3, label: "Activation Fee Payment Card", path: "assets/screenshots/organizer_onb_step3_fee_payment.png", description: "Step 2: Pay one-time 1.00 TON organizer activation fee" },
      { step: 4, label: "Organizer Channel Setup", path: "assets/screenshots/organizer_onb_step4_channel_setup.png", description: "Channel branding form with name, handles, bio, and avatar" },
      { step: 5, label: "Onboarded Profile & Create FAB", path: "assets/screenshots/organizer_onb_step5_ready_profile.png", description: "Verified channel card and floating + button to create events" }
    ],
    steps: [
      "Navigate to /my as standard user",
      "Inspect OrganizerProgress banner displaying step 1 Connect Wallet",
      "Connect TON wallet and observe transition to step 2 Activation Fee",
      "Inspect PaymentCard for one-time 1.00 TON organizer fee",
      "Navigate to /my/edit to configure channel branding and social handles",
      "Confirm transition to organizer profile with persistent create FAB (+)"
    ],
    assertions: [
      "OrganizerProgress displays step 1 and step 2 progression accurately",
      "PaymentCard activates organizer privileges via on-chain contract",
      "Channel metadata syncs with Telegram and X social links",
      "Create FAB router targets /events/create"
    ]
  },
  {
    id: "FLOW-O1",
    role: "Organizer",
    title: "Hosted Events Hub",
    description: "Overview of created events, draft states, attendee stats, and quick actions.",
    category: "Management",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o1_hosted.png",
    videoKeyword: "organizer_o1",
    stepScreenshots: [
      { step: 1, label: "Hosted Events Screen", path: "assets/screenshots/organizer_o1_step1_hosted_screen.png", description: "All upcoming and past events hosted by organizer" },
      { step: 2, label: "Event Card & Metrics", path: "assets/screenshots/organizer_o1_step2_event_card.png", description: "Event card displaying registrations, date, and status" },
      { step: 3, label: "Management Quick Actions", path: "assets/screenshots/organizer_o1_step3_quick_actions.png", description: "Quick access menu (Guest List, Scanner, Promo, Edit)" },
      { step: 4, label: "Status Filter Controls", path: "assets/screenshots/organizer_o1_step4_empty_or_filter.png", description: "Filtering by Published, Draft, or Past events" },
      { step: 5, label: "Create Event Action CTA", path: "assets/screenshots/organizer_o1_step5_create_cta.png", description: "Primary action button to launch Event Creation Wizard" }
    ],
    steps: [
      "Navigate to /my/hosted with organizer credentials",
      "Verify hosted events feed renders without Next.js exception",
      "Inspect registrations count and status badges",
      "Test filter tabs (Published / Draft / Past)"
    ],
    assertions: [
      "Events query events.getOrganizerEvents returns structured array",
      "No client-side crash occurs on empty or populated lists"
    ]
  },
  {
    id: "FLOW-O2",
    role: "Organizer",
    title: "5-Step Event Creation Wizard & Form Builder",
    description: "End-to-end event authoring from basic metadata to ticketing and publishing.",
    category: "Creation",
    criticality: "Critical",
    screenshot: "assets/screenshots/organizer_o2_create_event.png",
    videoKeyword: "organizer_o2",
    stepScreenshots: [
      { step: 1, label: "Step 1: General Info Empty", path: "assets/screenshots/organizer_o2_step1_general_empty.png", description: "Fresh creation form with required title and description fields" },
      { step: 2, label: "Step 1: Metadata Filled", path: "assets/screenshots/organizer_o2_step2_general_filled.png", description: "Completed event title, slug, and hosting organization" },
      { step: 3, label: "Step 2: MinIO Banner Upload", path: "assets/screenshots/organizer_o2_step3_banner_upload.png", description: "Drag-and-drop artwork upload with live thumbnail preview" },
      { step: 4, label: "Step 2: Date & Time Picker", path: "assets/screenshots/organizer_o2_step4_date_time.png", description: "Setting start date, end date, and local timezone" },
      { step: 5, label: "Step 3: Venue & Location", path: "assets/screenshots/organizer_o2_step5_location_venue.png", description: "Configuring physical venue location and Google Maps link" },
      { step: 6, label: "Step 3: Hub & Categories", path: "assets/screenshots/organizer_o2_step6_hub_category.png", description: "Selecting TON Hub ecosystem and event tag classification" },
      { step: 7, label: "Step 4: Custom Questionnaire", path: "assets/screenshots/organizer_o2_step7_questionnaire.png", description: "Configuring attendee registration questionnaire fields" },
      { step: 8, label: "Step 4: Ticketing & Pricing", path: "assets/screenshots/organizer_o2_step8_ticketing.png", description: "Free vs Paid ticket tiers, TON price, and capacity limits" },
      { step: 9, label: "Step 5: SBT Proof of Attendance", path: "assets/screenshots/organizer_o2_step9_sbt_rewards.png", description: "Configuring Soulbound token credential rules" },
      { step: 10, label: "Step 5: Publish Confirmation", path: "assets/screenshots/organizer_o2_step10_publish_confirmation.png", description: "Review checklist and Instant Publish button" }
    ],
    steps: [
      "Launch /create-event creation wizard",
      "Step 1: Enter title, description, and select organization",
      "Step 2: Upload cover banner image to MinIO and select schedule",
      "Step 3: Configure venue location and TON Hub category",
      "Step 4: Build custom questionnaire and configure ticket tiers",
      "Step 5: Configure Proof of Attendance SBT and tap Instant Publish"
    ],
    assertions: [
      "Image uploads return valid MinIO URL",
      "Event creation mutation events.createEvent responds with event UUID",
      "Event is instantly published or queued for post-moderation"
    ]
  },
  {
    id: "FLOW-O2A",
    role: "Organizer",
    title: "Scenario 1: Flagship Hackathon / Tech Summit",
    description: "Creation of TON Hacker House Dubai 2026: $100k prize tracks, curated waitlist, screening questions, paid VIP tier (15 TON NFT), and 3D crystal SBT.",
    category: "Creation Scenarios",
    criticality: "Critical",
    screenshot: "assets/screenshots/organizer_o2a_cover.png",
    videoKeyword: "organizer_o2a",
    stepScreenshots: [
      { step: 1, label: "General Info Blank Form", path: "assets/screenshots/organizer_o2a_step1_general_empty.png", description: "Initial creation stepper view for flagship hackathon" },
      { step: 2, label: "Hackathon Title & $100k Agenda", path: "assets/screenshots/organizer_o2a_step2_title_desc.png", description: "Luma-grade markdown agenda with DeFi, Gaming, and ZK prize tracks" },
      { step: 3, label: "Poster Artwork Upload", path: "assets/screenshots/organizer_o2a_step3_banner_upload.png", description: "1200x675 high-res cyber grid hackathon poster upload" },
      { step: 4, label: "Terms & Conditions Drawer", path: "assets/screenshots/organizer_o2a_step4_terms_modal.png", description: "Organizer code of conduct and ecosystem compliance terms" },
      { step: 5, label: "Dates, Grand Hyatt Venue & TON Hub", path: "assets/screenshots/organizer_o2a_step5_datetime_venue.png", description: "3-day in-person schedule at Grand Hyatt Dubai Conference Center" },
      { step: 6, label: "Registration, Approval & 300 Capacity", path: "assets/screenshots/organizer_o2a_step6_waitlist_approval.png", description: "Curated host approval required with 300-seat over-capacity waitlist" },
      { step: 7, label: "Builder Screening Questionnaire", path: "assets/screenshots/organizer_o2a_step7_builder_questions.png", description: "Custom fields: GitHub repo, track selection, and team roster" },
      { step: 8, label: "Paid VIP Tier (15 TON NFT)", path: "assets/screenshots/organizer_o2a_step8_paid_vip_tier.png", description: "VIP pass smart contract: 15 TON price, transferable NFT, custom artwork" },
      { step: 9, label: "Custom 3D Crystal SBT Credential", path: "assets/screenshots/organizer_o2a_step9_sbt_reward.png", description: "TEP-85 Soulbound Token attendance badge with door secret passcode" },
      { step: 10, label: "Review & Instant Publish", path: "assets/screenshots/organizer_o2a_step10_live_dashboard.png", description: "Order checklist review and 1-click Instant Publish confirmation" }
    ],
    steps: [
      "Configure title 'TON Hacker House Dubai 2026' with full markdown agenda",
      "Upload 1200x675 flagship poster and accept terms of service",
      "Set in-person venue at Grand Hyatt Dubai and select TON Society MEA Hub",
      "Enable attendee approval, set capacity to 300, and activate waitlist",
      "Add custom screening questions for GitHub repo and developer track",
      "Configure paid VIP ticket tier at 15.00 TON with transferable NFT pass",
      "Configure Genesis Crystal 3D SBT attendance credential",
      "Submit instant publish mutation and verify management redirect"
    ],
    assertions: [
      "All 4 stepper steps validate with zero schema errors",
      "Custom questionnaire schema accepts required URL and track select fields",
      "Paid event configuration binds recipient wallet and ticket NFT metadata",
      "Event instantly publishes without moderation blockage"
    ]
  },
  {
    id: "FLOW-O2B",
    role: "Organizer",
    title: "Scenario 2: Exclusive Private VIP Dinner & Roundtable",
    description: "Creation of Founders & Investors Sunset Soirée: secret venue toggle, strict 40-seat limit, executive vetting, and non-transferable cSBT.",
    category: "Creation Scenarios",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o2b_cover.png",
    videoKeyword: "organizer_o2b",
    stepScreenshots: [
      { step: 1, label: "Luxury Sunset Poster & Title", path: "assets/screenshots/organizer_o2b_step1_luxury_meta.png", description: "Golden-hour dinner poster and private soirée title" },
      { step: 2, label: "Secret Venue & Sunset Schedule", path: "assets/screenshots/organizer_o2b_step2_secret_venue.png", description: "Hidden venue address revealed only to approved ticket holders" },
      { step: 3, label: "Strict 40-Seat Banquet Capacity", path: "assets/screenshots/organizer_o2b_step3_strict_capacity.png", description: "Non-expandable banquet seating with waitlist disabled" },
      { step: 4, label: "Executive Vetting Screening", path: "assets/screenshots/organizer_o2b_step4_executive_vetting.png", description: "Vetting fields: Fund name, partner accreditation, and thesis" },
      { step: 5, label: "Executive cSBT Credential", path: "assets/screenshots/organizer_o2b_step5_executive_csbt.png", description: "Non-transferable Soulbound credential preventing ticket scalping" },
      { step: 6, label: "Published VIP Soirée Page", path: "assets/screenshots/organizer_o2b_step6_published_private.png", description: "Live VIP event page with Request to Join gate" }
    ],
    steps: [
      "Enter title 'Founders & Investors Sunset Soirée' with luxury dinner poster",
      "Activate secret venue toggle for CÉ LA VI Dubai",
      "Enforce strict 40-capacity limit and disable over-capacity waitlist",
      "Add executive accreditation screening questionnaire",
      "Issue non-transferable cSBT credential to approved attendees",
      "Publish private event with Request to Join approval gate"
    ],
    assertions: [
      "Secret venue address is protected from unauthenticated guests",
      "Registration cap cannot exceed 40 seats",
      "Executive cSBT mints as non-transferable Soulbound token"
    ]
  },
  {
    id: "FLOW-O2C",
    role: "Organizer",
    title: "Scenario 3: Global Online Masterclass & Livestream",
    description: "Creation of TON Mini App Mastery: broadcast stream URL, frictionless 1-tap RSVP, unlimited capacity, and on-air passphrase SBT.",
    category: "Creation Scenarios",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o2c_cover.png",
    videoKeyword: "organizer_o2c",
    stepScreenshots: [
      { step: 1, label: "Developer Masterclass Banner", path: "assets/screenshots/organizer_o2c_step1_developer_meta.png", description: "Dark-mode Next.js 15 technical masterclass banner" },
      { step: 2, label: "Livestream Broadcast URL", path: "assets/screenshots/organizer_o2c_step2_stream_link.png", description: "Online stream link and global broadcast schedule" },
      { step: 3, label: "Frictionless 1-Tap RSVP", path: "assets/screenshots/organizer_o2c_step3_frictionless_rsvp.png", description: "Zero-friction instant registration with unlimited capacity" },
      { step: 4, label: "Virtual SBT Passphrase", path: "assets/screenshots/organizer_o2c_step4_passkey_sbt.png", description: "On-air stream secret passphrase (TON_BUILDER_2026)" },
      { step: 5, label: "Published Stream Portal", path: "assets/screenshots/organizer_o2c_step5_live_stream_view.png", description: "Live online masterclass room with broadcast link" }
    ],
    steps: [
      "Configure developer masterclass title and Next.js 15 curriculum",
      "Set online event mode with broadcast URL and global schedule",
      "Enable frictionless 1-tap RSVP with unlimited capacity",
      "Configure Proof of Attendance SBT with secret on-air passphrase",
      "Publish global masterclass room with calendar sync"
    ],
    assertions: [
      "Broadcast stream link validates as secure URL",
      "Registration requires zero approval friction",
      "SBT passcode gate validates against secret passphrase"
    ]
  },
  {
    id: "FLOW-O2D",
    role: "Organizer",
    title: "Scenario 4: Competitive Esports Tournament",
    description: "Creation of Onion Arena Cyber Cup 2026: 32-team tournament bracket, 5.00 TON team entry fee, and ARENA50 promo discount.",
    category: "Creation Scenarios",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o2d_cover.png",
    videoKeyword: "organizer_o2d",
    stepScreenshots: [
      { step: 1, label: "Cyberpunk Tournament Banner", path: "assets/screenshots/organizer_o2d_step1_cyber_meta.png", description: "Cyber arena poster and 5,000 TON prize pool format" },
      { step: 2, label: "Tournament Bracket Schedule", path: "assets/screenshots/organizer_o2d_step2_bracket_schedule.png", description: "Double elimination bracket feed and match times" },
      { step: 3, label: "5.00 TON Squad Entry Fee", path: "assets/screenshots/organizer_o2d_step3_paid_entry_fee.png", description: "Paid entry fee per squad with 32 tournament slots" },
      { step: 4, label: "ARENA50 Promo Code (50% Off)", path: "assets/screenshots/organizer_o2d_step4_promo_discount.png", description: "Early bird promo code and captain Telegram handle field" },
      { step: 5, label: "Published Tournament Hub", path: "assets/screenshots/organizer_o2d_step5_tournament_hub.png", description: "Live Cyber Cup arena with prize breakdown and bracket" }
    ],
    steps: [
      "Configure tournament title, prize pool, and cyberpunk artwork",
      "Set double elimination tournament bracket URL and schedule",
      "Set paid squad entry fee at 5.00 TON with 32-slot capacity",
      "Configure ARENA50 discount code for 50% early bird registration",
      "Publish competitive gaming arena to Play2Win ecosystem"
    ],
    assertions: [
      "Paid squad entry fee correctly calculates 5.00 TON smart contract transfer",
      "ARENA50 discount applies 50% price reduction",
      "Tournament slots cap strictly at 32 squads"
    ]
  },
  {
    id: "FLOW-O2E",
    role: "Organizer",
    title: "Scenario 5: Casual Community Builder Meetup",
    description: "Creation of TON Community Coffee & Demos: Alserkal Avenue venue, free open RSVP, and door check-in officer delegation.",
    category: "Creation Scenarios",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o2e_cover.png",
    videoKeyword: "organizer_o2e",
    stepScreenshots: [
      { step: 1, label: "Community Coffee Poster", path: "assets/screenshots/organizer_o2e_step1_community_meta.png", description: "Warm community coffee poster and lightning demo format" },
      { step: 2, label: "Alserkal Avenue Venue", path: "assets/screenshots/organizer_o2e_step2_coffee_venue.png", description: "Nightjar Coffee Roasters venue details and map pin" },
      { step: 3, label: "Free Open Admission", path: "assets/screenshots/organizer_o2e_step3_free_open_rsvp.png", description: "Instant registration with 75 attendee capacity" },
      { step: 4, label: "Check-in Officer Delegation", path: "assets/screenshots/organizer_o2e_step4_officer_delegation.png", description: "Delegating door QR scanner rights to co-organizers" },
      { step: 5, label: "Published Community Meetup", path: "assets/screenshots/organizer_o2e_step5_published_meetup.png", description: "Live community meetup card with 1-tap RSVP" }
    ],
    steps: [
      "Enter title 'TON Community Coffee & Demos' with coffee poster",
      "Set venue at Nightjar Coffee Roasters in Alserkal Avenue",
      "Enable free open admission with 75 attendee capacity",
      "Authorize co-organizer check-in officers for door QR scanning",
      "Publish community meetup to local chapter feed"
    ],
    assertions: [
      "Free admission requires 0 TON payment",
      "Officer delegation grants door scanning permissions",
      "QR pass generates instantly upon RSVP"
    ]
  },
  {
    id: "FLOW-O3",
    role: "Organizer",
    title: "Event Management Dashboard & Sub-modules",
    description: "Manage guest list, promo codes, check-in officers, orders, and co-hosts.",
    category: "Management",
    criticality: "Critical",
    screenshot: "assets/screenshots/organizer_o3_manage_root.png",
    videoKeyword: "organizer_o3",
    stepScreenshots: [
      { step: 1, label: "Management Root Dashboard", path: "assets/screenshots/organizer_o3_step1_manage_root.png", description: "Overview metrics: Total RSVPs, Checked In, Revenue, Conversion" },
      { step: 2, label: "Attendee Guest List Table", path: "assets/screenshots/organizer_o3_step2_guest_list.png", description: "Interactive attendee roster with status chips and action buttons" },
      { step: 3, label: "Attendee Answers Drawer", path: "assets/screenshots/organizer_o3_step3_attendee_details.png", description: "Detailed view of attendee custom registration responses" },
      { step: 4, label: "Promo Codes Table", path: "assets/screenshots/organizer_o3_step3_promo_codes.png", description: "Active discount codes, usage counts, and expiry dates" },
      { step: 5, label: "Create Promo Code Dialog", path: "assets/screenshots/organizer_o3_step5_create_promo.png", description: "Configuring promo code string, discount %, and max redemptions" },
      { step: 6, label: "Co-Organizers & Officers", path: "assets/screenshots/organizer_o3_step4_co_organizers.png", description: "Delegated check-in officers and permissions management" },
      { step: 7, label: "Add Check-in Officer Modal", path: "assets/screenshots/organizer_o3_step7_add_officer.png", description: "Delegating check-in scanner permissions by Telegram handle" },
      { step: 8, label: "Orders & Transactions Ledger", path: "assets/screenshots/organizer_o3_step8_orders.png", description: "Itemized ticket orders and TON blockchain payment records" }
    ],
    steps: [
      "Navigate to /events/[uuid]/manage",
      "Inspect management dashboard metrics",
      "Navigate into Guest List sub-module and inspect attendees",
      "Navigate into Promo Codes and create discount code",
      "Navigate into Co-organizers and delegate officer role",
      "Inspect ticket orders and blockchain payments ledger"
    ],
    assertions: [
      "Guest list loads without crying duck error",
      "Promo codes load without 'No auth header' error",
      "Role delegation mutations succeed with audit record"
    ]
  },
  {
    id: "FLOW-O4",
    role: "Organizer",
    title: "Attendee Guest List Export API",
    description: "Export full attendee rosters with responses to CSV and Excel formats.",
    category: "Data & Privacy",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o4_guest_list_export.png",
    videoKeyword: "organizer_o4",
    stepScreenshots: [
      { step: 1, label: "Export Button Trigger", path: "assets/screenshots/organizer_o4_step1_export_button.png", description: "Export button in guest list table header" },
      { step: 2, label: "Export Customization Dialog", path: "assets/screenshots/organizer_o4_step2_export_options.png", description: "Selecting columns (Name, Email, Handle, Status, Answers)" },
      { step: 3, label: "Export Streaming Progress", path: "assets/screenshots/organizer_o4_step3_stream_progress.png", description: "Server streaming generation indicator for large attendee sets" },
      { step: 4, label: "File Download Completed", path: "assets/screenshots/organizer_o4_step4_download_complete.png", description: "Browser downloads .xlsx / .csv file securely" },
      { step: 5, label: "Server Authorization & Audit", path: "assets/screenshots/organizer_o4_step5_api_security.png", description: "Verifying role permission check before file stream dispatch" }
    ],
    steps: [
      "Click Export Attendees button in guest list header",
      "Select desired export format (CSV or Excel)",
      "Trigger download stream from /api/client/v1/protected/exportRegistrants",
      "Verify file download completes with valid data rows"
    ],
    assertions: [
      "Export endpoint returns 200 with attachment headers",
      "Non-organizers receive 403 Forbidden"
    ]
  },
  {
    id: "FLOW-O5",
    role: "Organizer",
    title: "Soulbound Token (SBT) Setup",
    description: "Proof of attendance credential authoring, metadata builder, and contract deploy.",
    category: "Web3 Credentials",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o5_sbt_setup.png",
    videoKeyword: "organizer_o5",
    stepScreenshots: [
      { step: 1, label: "Enable SBT Reward Toggle", path: "assets/screenshots/organizer_o5_step1_sbt_toggle.png", description: "Activating Proof of Attendance credential for event" },
      { step: 2, label: "SBT Badge Metadata Builder", path: "assets/screenshots/organizer_o5_step2_metadata_builder.png", description: "Setting badge name, description, and high-res SVG artwork" },
      { step: 3, label: "Claim Rules Configuration", path: "assets/screenshots/organizer_o5_step3_claim_rules.png", description: "Requiring physical check-in or secret passkey to claim" },
      { step: 4, label: "Collection Smart Contract", path: "assets/screenshots/organizer_o5_step4_collection_contract.png", description: "Deploying / linking TEP-85 collection contract on TON" },
      { step: 5, label: "SBT Configuration Confirmed", path: "assets/screenshots/organizer_o5_step5_save_sbt.png", description: "Soulbound token badge linked and ready for attendees" }
    ],
    steps: [
      "Navigate to SBT Management tab in event settings",
      "Enable Proof of Attendance reward toggle",
      "Specify badge metadata traits (TEP-64 standard)",
      "Set claim rule: Checked-in attendees only",
      "Save configuration and link TEP-85 collection"
    ],
    assertions: [
      "POA configuration saved via POA.configurePOA",
      "Collection address format validated against TON testnet"
    ]
  },
  {
    id: "FLOW-O6",
    role: "Organizer",
    title: "Raffle & Random Giveaway Setup",
    description: "On-stage random giveaways, checked-in attendee qualification, and animations.",
    category: "Engagement",
    criticality: "High",
    screenshot: "assets/screenshots/organizer_o6_raffle_config.png",
    videoKeyword: "organizer_o6",
    stepScreenshots: [
      { step: 1, label: "Raffle Management Tab", path: "assets/screenshots/organizer_o6_step1_raffle_tab.png", description: "Accessing event giveaway and raffle control module" },
      { step: 2, label: "Create Raffle Form", path: "assets/screenshots/organizer_o6_step2_create_raffle.png", description: "Setting prize title, quantity of winners, and sponsor tag" },
      { step: 3, label: "Checked-in Eligibility Filter", path: "assets/screenshots/organizer_o6_step3_eligibility.png", description: "Restricting prize pool strictly to verified checked-in attendees" },
      { step: 4, label: "Random Draw Animation", path: "assets/screenshots/organizer_o6_step4_draw_animation.png", description: "Provably fair on-screen random selection spinner" },
      { step: 5, label: "Winner Announcement Card", path: "assets/screenshots/organizer_o6_step5_winner_announcement.png", description: "Public winner declaration and direct message dispatch" }
    ],
    steps: [
      "Open Raffle sub-module for active event",
      "Configure giveaway title, prize, and number of winners",
      "Select eligibility: Checked-in attendees only",
      "Trigger random draw spinner on presentation screen",
      "Announce winners and notify winning Telegram accounts"
    ],
    assertions: [
      "Raffle draw selects only from checked-in attendees pool",
      "Raffle history saved in raffleRouter.ts database table"
    ]
  },

  // ROLE 4: CHECK-IN OFFICER PERSONA
  {
    id: "FLOW-C1",
    role: "Check-in Officer",
    title: "Digital QR Code Scanner & Checkin API",
    description: "Validate attendee QR codes in real time with audio-visual confirmation.",
    category: "Checkin",
    criticality: "Critical",
    screenshot: "assets/screenshots/checkin_c1_scanner.png",
    videoKeyword: "checkin_c1",
    stepScreenshots: [
      { step: 1, label: "Camera Viewfinder HUD", path: "assets/screenshots/checkin_c1_step1_camera_view.png", description: "High-speed camera viewfinder with targeting reticle and status bar" },
      { step: 2, label: "QR Code Detected & Reading", path: "assets/screenshots/checkin_c1_step2_scanning_qr.png", description: "Laser reticle locks onto attendee QR pass and extracts payload" },
      { step: 3, label: "Cryptographic Validation", path: "assets/screenshots/checkin_c1_step3_validating.png", description: "Real-time verification against event private key and database" },
      { step: 4, label: "Attendee Verified Card & Tier", path: "assets/screenshots/checkin_c1_step4_attendee_card.png", description: "Displaying attendee name, photo, ticket tier, and company" },
      { step: 5, label: "Check-In Success Confirmation", path: "assets/screenshots/checkin_c1_step5_admit_success.png", description: "Vibrant green check-in confirmation with audible haptic feedback" },
      { step: 6, label: "Soulbound Token Minting Queued", path: "assets/screenshots/checkin_c1_step6_sbt_auto_trigger.png", description: "Proof of Attendance SBT minting trigger automatically fired" }
    ],
    steps: [
      "Launch QR scanner camera interface as delegated check-in officer",
      "Scan attendee dynamic QR ticket pass",
      "Verify real-time cryptographic validation against backend",
      "Inspect attendee verification card with photo and ticket tier",
      "Receive Check-In Successful confirmation and SBT trigger"
    ],
    assertions: [
      "Endpoint POST /api/client/v1/protected/checkin marks ticket checked in",
      "Proof of attendance minting trigger queued for attendee",
      "Scan operation takes less than 500ms"
    ]
  },
  {
    id: "FLOW-C2",
    role: "Check-in Officer",
    title: "Protected Guest List & Manual Checkin",
    description: "Search attendees by name/handle and manually toggle check-in status.",
    category: "Checkin",
    criticality: "High",
    screenshot: "assets/screenshots/checkin_c2_manual_checkin.png",
    videoKeyword: "checkin_c2",
    stepScreenshots: [
      { step: 1, label: "Officer Attendee Roster View", path: "assets/screenshots/checkin_c2_step1_officer_list.png", description: "Searchable attendee list scoped to authorized check-in officer" },
      { step: 2, label: "Search Attendee by Handle", path: "assets/screenshots/checkin_c2_step2_search_attendee.png", description: "Fast real-time filtering by Telegram handle or full name" },
      { step: 3, label: "Attendee Match Elena Rostova", path: "assets/screenshots/checkin_c2_step3_attendee_match.png", description: "Matching attendee profile card displayed with Pending status" },
      { step: 4, label: "Manual Check-In Override", path: "assets/screenshots/checkin_c2_step4_manual_toggle.png", description: "Officer activates manual override check-in button" },
      { step: 5, label: "Status Updated: Checked In", path: "assets/screenshots/checkin_c2_step5_confirmed_state.png", description: "Status badge instantly transitions to green Checked In" }
    ],
    steps: [
      "Open manual guest list view on officer device",
      "Search for attendee by username '@elenarostova'",
      "Tap Manual Check In button",
      "Verify attendee status transitions to Checked In"
    ],
    assertions: [
      "Guest list endpoint returns scoped attendee array",
      "Attendee check-in status updates immediately in database"
    ]
  },
  {
    id: "FLOW-C3",
    role: "Check-in Officer",
    title: "Duplicate Scan Prevention & Fraud Protection",
    description: "Prevent multiple admissions on the same ticket with cryptographic timestamp audit.",
    category: "Security",
    criticality: "Critical",
    screenshot: "assets/screenshots/checkin_c3_fraud_prevention.png",
    videoKeyword: "checkin_c3",
    stepScreenshots: [
      { step: 1, label: "Re-scanning Admitted QR Pass", path: "assets/screenshots/checkin_c3_step1_rescan_attempt.png", description: "Second attendee presents screenshot of already used QR pass" },
      { step: 2, label: "Warning: ALREADY CHECKED IN", path: "assets/screenshots/checkin_c3_step2_duplicate_alert.png", description: "Prominent red warning modal alert blocking admission" },
      { step: 3, label: "Prior Scan Timestamp Audit", path: "assets/screenshots/checkin_c3_step3_prior_timestamp.png", description: "Displaying exact prior check-in timestamp and officer ID" },
      { step: 4, label: "Fraud Flag Logged in Ledger", path: "assets/screenshots/checkin_c3_step4_fraud_flag.png", description: "Replay attempt recorded in security audit log with IP/device" },
      { step: 5, label: "Dismiss Alert & Resume Scanner", path: "assets/screenshots/checkin_c3_step5_dismiss_resume.png", description: "Officer dismisses alert and viewfinder instantly resumes scanning" }
    ],
    steps: [
      "Scan ticket pass that was previously admitted",
      "Verify red warning modal 'ALREADY CHECKED IN' displays immediately",
      "Inspect prior scan timestamp and admitting officer identity",
      "Verify replay attempt is logged in security audit table",
      "Dismiss alert to resume scanning"
    ],
    assertions: [
      "System strictly blocks second admission attempt",
      "Audit trail records timestamp of second scan attempt"
    ]
  },

  // ROLE 5: PLATFORM ADMIN PERSONA
  {
    id: "FLOW-A1",
    role: "Admin",
    title: "Admin Panel Authentication & Verification APIs",
    description: "Secure email verification code challenge and administrative session management.",
    category: "Authentication",
    criticality: "Critical",
    screenshot: "assets/screenshots/admin_a1_auth.png",
    videoKeyword: "admin_a1",
    stepScreenshots: [
      { step: 1, label: "Admin Email Input Challenge", path: "assets/screenshots/admin_a1_step1_email_input.png", description: "Secured admin panel login with corporate email challenge" },
      { step: 2, label: "6-Digit OTP Code Dispatched", path: "assets/screenshots/admin_a1_step2_send_code.png", description: "One-time password dispatched via SMTP mailer" },
      { step: 3, label: "Verification Code Entry Boxes", path: "assets/screenshots/admin_a1_step3_code_entry.png", description: "Entering 6-digit cryptographic verification code" },
      { step: 4, label: "Rate Limiting Brute-Force Defense", path: "assets/screenshots/admin_a1_step4_rate_limiting.png", description: "Automated rate limiting and attempt throttling defense" },
      { step: 5, label: "Admin Session Token Issued", path: "assets/screenshots/admin_a1_step5_session_issued.png", description: "HTTP-only secure admin session cookie issued" }
    ],
    steps: [
      "Navigate to admin login panel",
      "Submit authorized admin email address",
      "Receive 6-digit OTP code challenge",
      "Enter code and verify session issuance with rate limiting checks"
    ],
    assertions: [
      "Email verification code sent via mailer transport",
      "Rate-limiting prevents brute force code submission",
      "Session invalidation clears authorization cookies"
    ]
  },
  {
    id: "FLOW-A2",
    role: "Admin",
    title: "Elevated Admin Permissions in Mini-App",
    description: "Gold PLATFORM ADMIN badge, elevated moderation controls, and system health.",
    category: "Administration",
    criticality: "Critical",
    screenshot: "assets/screenshots/admin_a2_profile.png",
    videoKeyword: "admin_a2",
    stepScreenshots: [
      { step: 1, label: "Platform Admin Gold Badge", path: "assets/screenshots/admin_a2_step1_header.png", description: "Elevated profile with gold PLATFORM ADMIN badge" },
      { step: 2, label: "Admin Master Metrics", path: "assets/screenshots/admin_a2_step2_activity.png", description: "Global metrics: platform events, total users, and volume" },
      { step: 3, label: "Elevated Moderation Menu", path: "assets/screenshots/admin_a2_step3_elevated_actions.png", description: "Quick navigation to Moderation, User Roles, and Logs" },
      { step: 4, label: "Microservices & MinIO Health", path: "assets/screenshots/admin_a2_step4_system_status.png", description: "Real-time status of PostgreSQL, Redis, MinIO, and Bot" },
      { step: 5, label: "Role Impersonation Diagnostic", path: "assets/screenshots/admin_a2_step5_impersonation.png", description: "Testing interface to inspect app as any role or user" }
    ],
    steps: [
      "Authenticate as platform admin in Mini-App",
      "Inspect profile header with gold PLATFORM ADMIN badge",
      "Review platform master metrics and microservices health",
      "Test diagnostic role impersonation controls"
    ],
    assertions: [
      "Admin role verified via users.haveAccessToEventAdministration",
      "Elevated navigation actions rendered only for admin role"
    ]
  },
  {
    id: "FLOW-A3",
    role: "Admin",
    title: "Event Moderation Queue & Content Control",
    description: "Luma-style instant publish post-moderation queue and enforcement actions.",
    category: "Governance",
    criticality: "High",
    screenshot: "assets/screenshots/admin_a3_moderation.png",
    videoKeyword: "admin_a3",
    stepScreenshots: [
      { step: 1, label: "Global Event Moderation Queue", path: "assets/screenshots/admin_a3_step1_pending_events.png", description: "Queue of recently submitted events across the ecosystem" },
      { step: 2, label: "Event Content Inspection", path: "assets/screenshots/admin_a3_step2_event_inspection.png", description: "Detailed inspection of event artwork, links, and description" },
      { step: 3, label: "Automated Compliance Checks", path: "assets/screenshots/admin_a3_step3_compliance_checks.png", description: "Automated scanning for illicit links, scams, or spam content" },
      { step: 4, label: "Instant Publish Toggle", path: "assets/screenshots/admin_a3_step4_post_moderation_toggle.png", description: "Luma-style instant publish toggle with post-moderation review" },
      { step: 5, label: "Unpublish Suspension Action", path: "assets/screenshots/admin_a3_step5_unpublish_action.png", description: "Admin override button to unpublish or suspend non-compliant events" },
      { step: 6, label: "Moderation Audit Trail Log", path: "assets/screenshots/admin_a3_step6_audit_trail.png", description: "Full audit log recording moderator action and justification" }
    ],
    steps: [
      "Access global event moderation queue",
      "Review newly submitted events and automated compliance scores",
      "Inspect instant publish mode toggle (Luma paradigm)",
      "Test unpublish / suspension override action and audit logging"
    ],
    assertions: [
      "Admin can take down malicious events instantly",
      "Audit trail records moderator user ID and timestamp"
    ]
  },
  {
    id: "FLOW-A4",
    role: "Admin",
    title: "System Analytics & Points Ledger",
    description: "Platform growth metrics, ticket volume, token circulating supply, and audits.",
    category: "Analytics",
    criticality: "High",
    screenshot: "assets/screenshots/admin_a4_analytics.png",
    videoKeyword: "admin_a4",
    stepScreenshots: [
      { step: 1, label: "DAU & Retention Analytics", path: "assets/screenshots/admin_a4_step1_analytics_hub.png", description: "Growth dashboard tracking DAU, MAU, and 30-day retention" },
      { step: 2, label: "Ticket Issuance Volume", path: "assets/screenshots/admin_a4_step2_ticket_volume.png", description: "Volume charts across Free, Standard TON, and VIP tiers" },
      { step: 3, label: "ONION Circulating Supply", path: "assets/screenshots/admin_a4_step3_points_minted.png", description: "Total points minted, claimed, burned, and circulating" },
      { step: 4, label: "Top Organizers Leaderboard", path: "assets/screenshots/admin_a4_step4_top_organizers.png", description: "Organizer leaderboard by attendance and gross ticket volume" },
      { step: 5, label: "Platform Audit Export", path: "assets/screenshots/admin_a4_step5_export_audit.png", description: "Export comprehensive compliance and revenue audit report" }
    ],
    steps: [
      "Open platform analytics dashboard",
      "Inspect Daily Active Users (DAU) and 30-day cohort retention",
      "Inspect ticket volume distribution across tiers",
      "Review ONION token supply metrics and export platform audit report"
    ],
    assertions: [
      "Analytics calculations match raw database aggregate queries",
      "Audit report exports complete without data truncation"
    ]
  },

  // ROLE 6: PARTNER / AFFILIATE PERSONA
  {
    id: "FLOW-P1",
    role: "Partner",
    title: "Affiliate Dashboard & Referral Metrics",
    description: "Generate campaign tracking links and track referral conversions and payouts.",
    category: "Affiliate",
    criticality: "High",
    screenshot: "assets/screenshots/partner_p1_affiliate.png",
    videoKeyword: "partner_p1",
    stepScreenshots: [
      { step: 1, label: "Partner Affiliate Hub", path: "assets/screenshots/partner_p1_step1_affiliate.png", description: "Dedicated affiliate dashboard with unique referral link" },
      { step: 2, label: "Copy Referral Link Toast", path: "assets/screenshots/partner_p1_step2_copy_link.png", description: "One-tap clipboard copy with visual confirmation toast" },
      { step: 3, label: "Referral Conversion Funnel", path: "assets/screenshots/partner_p1_step3_referral_stats.png", description: "Real-time conversion funnel and active organizer count" },
      { step: 4, label: "Commission Tiers & Multipliers", path: "assets/screenshots/partner_p1_step4_commission_tiers.png", description: "Tier progression and revenue share percentage" },
      { step: 5, label: "Payout History & ONION Bonuses", path: "assets/screenshots/partner_p1_step5_payout_history.png", description: "Detailed log of credited commission payouts and bonuses" }
    ],
    steps: [
      "Navigate to /my/partner/onion-affiliate",
      "Verify affiliate dashboard loads without 'Failed to load link' error",
      "Copy referral link and review conversion funnel metrics",
      "Inspect commission tiers and payout history"
    ],
    assertions: [
      "Affiliate code generated via affiliateRouter.getAffiliateCode",
      "Referral link contains valid UTM and Telegram start params"
    ]
  },
  {
    id: "FLOW-P2",
    role: "Partner",
    title: "Deep Link Referral Attribution",
    description: "Track user onboarding via tgWebAppStartParam and attribute event registrations.",
    category: "Affiliate",
    criticality: "High",
    screenshot: "assets/screenshots/partner_p2_deeplink.png",
    videoKeyword: "partner_p2",
    stepScreenshots: [
      { step: 1, label: "Deep Link Landing Screen", path: "assets/screenshots/partner_p2_step1_deeplink.png", description: "New user lands via custom partner referral parameter" },
      { step: 2, label: "Invited by Bonus Banner", path: "assets/screenshots/partner_p2_step2_attribution_banner.png", description: "Welcome banner acknowledging partner invitation" },
      { step: 3, label: "Cookie & Session Attribution", path: "assets/screenshots/partner_p2_step3_cookie_storage.png", description: "Client-side and session cookie binding to affiliate code" },
      { step: 4, label: "Registration Conversion", path: "assets/screenshots/partner_p2_step4_signup_conversion.png", description: "User completes registration attributing conversion" },
      { step: 5, label: "Dual Reward Notification", path: "assets/screenshots/partner_p2_step5_dual_reward.png", description: "Both new user and referring partner receive ONION bonus" }
    ],
    steps: [
      "Launch app with ?start=join-mfarimani deep link parameter",
      "Inspect referral banner 'Invited by @Mfarimani'",
      "Verify affiliate attribution cookie is saved",
      "Complete registration and verify dual bonus reward attribution"
    ],
    assertions: [
      "Cookie and sessionStorage properly preserve referral tag",
      "Affiliate ledger credits referral bonus to both parties"
    ]
  },
  {
    id: "FLOW-P3",
    role: "Partner",
    title: "Channel Co-Branding & Community Host",
    description: "Verified community hub, co-branded events list, member perks, and analytics.",
    category: "Ecosystem",
    criticality: "Medium",
    screenshot: "assets/screenshots/partner_p3_channel_branding.png",
    videoKeyword: "partner_p3",
    stepScreenshots: [
      { step: 1, label: "Partner Verified Community Hub", path: "assets/screenshots/partner_p3_step1_community_hub.png", description: "Custom-branded hub header with partner logos and social links" },
      { step: 2, label: "Co-Branded Events List", path: "assets/screenshots/partner_p3_step2_co_branded_events.png", description: "Events co-hosted by partner with custom themed badges" },
      { step: 3, label: "Exclusive Member Perks", path: "assets/screenshots/partner_p3_step3_member_perks.png", description: "Token-gated or membership perks for channel subscribers" },
      { step: 4, label: "Automated Telegram Channel Sync", path: "assets/screenshots/partner_p3_step4_telegram_sync.png", description: "Real-time synchronization of Telegram channel subscriber status" },
      { step: 5, label: "Channel Member Analytics", path: "assets/screenshots/partner_p3_step5_channel_analytics.png", description: "Engagement metrics showing ticket sales and attendee retention" }
    ],
    steps: [
      "Open partner verified community channel page",
      "Inspect custom co-branding elements and banner artwork",
      "Review exclusive member perks and hosted events list",
      "Verify channel member growth analytics"
    ],
    assertions: [
      "Community hub renders with partner badges and styles",
      "Channel member counts sync via telegramInteractions router"
    ]
  },

  // SPECIAL: cSBT ZERO-GAS MERKLE CLAIM
  {
    id: "FLOW-W1",
    role: "User",
    title: "Native cSBT Zero-Gas Merkle Claim",
    description: "Zero-gas soulbound credential claim via Merkle proof and relayer contract dispatch.",
    category: "Web3 SBT",
    criticality: "Critical",
    screenshot: "assets/screenshots/sbt_w1_csbt_claim.png",
    videoKeyword: "sbt_lifecycle",
    stepScreenshots: [
      { step: 1, label: "cSBT Engine: Eligibility Check", path: "assets/screenshots/sbt_w1_step1_eligibility.png", description: "Verified attendance check granting claim eligibility" },
      { step: 2, label: "Zero-Gas Claim Action Active", path: "assets/screenshots/sbt_w1_step2_claim_button.png", description: "Claim Soulbound Badge button active with 0 TON gas fee" },
      { step: 3, label: "Merkle Tree Proof Generation", path: "assets/screenshots/sbt_w1_step3_merkle_proof.png", description: "Client generates cryptographic Merkle proof of attendance" },
      { step: 4, label: "Backend Relayer Transaction", path: "assets/screenshots/sbt_w1_step4_backend_relayer.png", description: "Sponsor relayer submits transaction without charging user wallet" },
      { step: 5, label: "On-Chain Mint Confirmation", path: "assets/screenshots/sbt_w1_step5_mint_success.png", description: "Confirmation screen with TON blockchain transaction explorer link" },
      { step: 6, label: "Permanent Profile Credential", path: "assets/screenshots/sbt_w1_step6_profile_badge.png", description: "Soulbound credential badge permanently displayed on attendee profile" }
    ],
    steps: [
      "Navigate to /csbt/claim as verified attendee",
      "Inspect eligibility verification checkmark",
      "Tap Claim Soulbound Badge (Zero-Gas)",
      "Verify client-side Merkle proof construction",
      "Verify backend relayer transaction dispatch to TON blockchain",
      "Confirm permanent cSBT badge is displayed on profile"
    ],
    assertions: [
      "Merkle proof verifies against on-chain root hash",
      "Relayer covers all gas fees without prompting wallet transfer",
      "cSBT badge permanently binds to attendee TON address"
    ]
  },

  // PROTOCOL / BOT FLOWS
  {
    id: "FLOW-SBT2",
    role: "Admin",
    title: "TonCenter On-Chain Testnet Verification",
    description: "Verify on-chain contract state and blockchain synchronization via TonCenter testnet RPC.",
    category: "Web3 SBT",
    criticality: "High",
    screenshot: "assets/screenshots/admin_a2_profile.png",
    videoKeyword: "sbt_onchain",
    stepScreenshots: [
      { step: 1, label: "TonCenter Account Query", path: "assets/screenshots/admin_a2_step4_system_status.png", description: "Query TonCenter testnet RPC for raw account state" },
      { step: 2, label: "Masterchain Block Synchronization", path: "assets/screenshots/sbt_w1_step4_backend_relayer.png", description: "Confirming consensus block finalization and state storage" }
    ],
    steps: [
      "Retrieve collection address from dev platform",
      "Query TonCenter /getAddressInformation for account state",
      "Query TonCenter /getMasterchainInfo for synchronization verification"
    ],
    assertions: [
      "TonCenter API responds with HTTP 200 using API key",
      "Account state payload returns valid block_id",
      "Masterchain seqno is strictly positive"
    ]
  },
  {
    id: "FLOW-TG1",
    role: "User",
    title: "MTProto Telegram Bot Interaction Loop",
    description: "End-to-end bot interaction via MTProto client as @ontonadmin testing /start and deep-links.",
    category: "Telegram Bot",
    criticality: "Critical",
    screenshot: "assets/screenshots/guest_g1_homepage.png",
    videoKeyword: "bot_loop",
    stepScreenshots: [
      { step: 1, label: "Bot Welcome Message", path: "assets/screenshots/guest_g1_step1_hero.png", description: "Send /start command to bot and receive structured welcome" },
      { step: 2, label: "Event Deep Link Routing", path: "assets/screenshots/guest_g3_step1_hero.png", description: "Send /start event_<uuid> and verify bot routing" },
      { step: 3, label: "Channel Membership Verification", path: "assets/screenshots/user_u7_step4_verifying_state.png", description: "Automated check verifying attendee joined required Telegram channel" }
    ],
    steps: [
      "Verify tgadmin MTProto session is authenticated",
      "Send /start to @theontonbot and receive welcome payload",
      "Send /start event_<uuid> deep link parameter",
      "Test unhandled deep-link prefix fallthrough"
    ],
    assertions: [
      "Bot responds with 'Welcome to ONTON' within 3 seconds",
      "Welcome payload contains core RSVP and Stars features",
      "Session authenticated as @ontonadmin (ID: 7013087032)"
    ]
  },
  {
    id: "FLOW-AUTH1",
    role: "User",
    title: "Multi-Provider Identity & Authentication Gateways",
    description: "Verify email OTP challenge, Telegram initData verification, and session guards.",
    category: "Authentication",
    criticality: "Critical",
    screenshot: "assets/screenshots/admin_a1_auth.png",
    videoKeyword: "auth_multiprovider",
    stepScreenshots: [
      { step: 1, label: "Email OTP Challenge", path: "assets/screenshots/admin_a1_step1_email_input.png", description: "POST /api/v1/auth/email/send-otp validation" },
      { step: 2, label: "Cryptographic Code Verification", path: "assets/screenshots/admin_a1_step3_code_entry.png", description: "Exchange 6-digit OTP code for authenticated session cookie" },
      { step: 3, label: "Telegram Mini App initData Auth", path: "assets/screenshots/guest_g7_step3_telegram_option.png", description: "Validate HMAC-SHA256 signature of Telegram initData" },
      { step: 4, label: "Web3 TonConnect Wallet Auth", path: "assets/screenshots/guest_g7_step4_web3.png", description: "Cryptographic signature verification via tonProofRouter.ts" }
    ],
    steps: [
      "POST /api/v1/auth/email/send-otp validates mandatory email",
      "POST /api/v1/auth/email/send-otp issues challenge for valid address",
      "POST /api/v1/auth/email/verify-otp rejects invalid codes with 401",
      "GET /api/v1/auth/me enforces session presence",
      "POST /api/v1/auth/telegram rejects invalid HMAC signatures"
    ],
    assertions: [
      "Missing email returns 400 with descriptive error",
      "Invalid OTP returns 401 Unauthorized",
      "Unauthenticated /me returns 401",
      "Tampered Telegram initData rejected with 401"
    ]
  }
];

const startMarker = "// Define the comprehensive flow matrix with multi-step screenshots\nconst flowsCatalog = ";
const endMarker = "\n\n// Comprehensive 25 Identified Flaws Catalog with Status & Resolutions";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find markers in generate-portal-data.js!");
  process.exit(1);
}

const newCatalogStr = startMarker + JSON.stringify(flowsCatalog, null, 2) + ";";
const updatedContent = content.substring(0, startIndex) + newCatalogStr + content.substring(endIndex);

fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log("Successfully updated generate-portal-data.js with complete deliberate flows catalog!");
