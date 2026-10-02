# 📦 ONTON Staging: Test Data & Event Archetypes Guide

To thoroughly test the ONTON platform without manual trial-and-error, this guide outlines the **7 Core Event Archetypes** and how to provision test data on Staging (`@notnonstagebot`).

---

## 1. The 7 Core Test Event Archetypes

Every full UAT regression cycle tests these 7 event variations to ensure all checkout, moderation, and ticketing pathways work reliably:

| # | Archetype | Key Characteristics | What QA Verifies |
| :- | :--- | :--- | :--- |
| **1** | **Free RSVP Event** | Capacity limit, 0 cost, instant ticket issuance | Clean 1-tap checkout, instant QR pass generation, capacity counter decrement. |
| **2** | **Approval-Gated Event** | Requires organizer approval, custom screening questions | Attendee sees "Application Submitted", Organizer approves in dashboard, Attendee receives bot notification and ticket unlocks. |
| **3** | **Paid Telegram Stars** | Ticket price in Stars (e.g. 50 Stars) | Telegram Stars invoice popup, checkout in sandbox mode, instant payment confirmation and ticket receipt. |
| **4** | **Paid Crypto (TON/Jetton)** | Price in TON or USDT (testnet) | Tonkeeper testnet deep link, memo/comment inclusion, order polling/fulfillment worker confirmation. |
| **5** | **Online Livestream** | Virtual venue with gated streaming link | Streaming URL (e.g. YouTube Live, Zoom, Telegram Stream) remains hidden until ticket is confirmed, then unlocks in ticket pass. |
| **6** | **Soulbound (SBT / PoA)** | Issues an on-chain Proof of Attendance badge | QR check-in triggers SBT minting job; user can view badge in profile and verify on Tonviewer testnet. |
| **7** | **Contest / Tournament** | Leaderboard, scoring, or raffle mechanism | Participant joining, score submission / raffle entry, winner draw. |

---

## 2. Setting Up Test Events on Staging

### Method A: Creating Test Events via the Mini App Wizard (Manual UAT)
1. Open `@notnonstagebot` on your **Account A (Organizer account)**.
2. Open the Mini App and navigate to the **Host / Create** tab.
3. Complete the multi-step creation wizard:
   - **Step 1: Basic Info** — Set Title (e.g., `[QA-TEST] Stars Gala 2026`), Date/Time, and Upload Cover Image.
   - **Step 2: Location** — Choose In-Person (Venue name + address) or Online (enter virtual meeting link).
   - **Step 3: Ticketing** — Configure ticket tiers (Free, Stars, or Crypto) and set max capacity.
   - **Step 4: Questionnaire (Optional)** — Add custom screening questions (Single-choice, Short answer, Multi-select).
   - **Step 5: Publishing** — Review and tap **Publish Event**.
4. Once published, copy the deep link (`https://t.me/notnonstagebot/event?startapp=YOUR_EVENT_SLUG`) and switch to **Account B (Attendee account)** to test the registration experience.

### Method B: Requesting Developer Seed Events
If you require automated bulk-seeded events (for stress-testing large attendee lists, concurrent QR check-ins, or testing edge-case dates), request the engineering lead to run the staging seed helper:
- Seed events are created with clear `[QA-STAGING]` prefixes.
- Staging test events include pre-populated descriptions, Lu.ma-style posters, and configured ticket tiers.

---

## 3. Managing Test Attendees & Verification

### A. Resetting an Attendee's Registration
If you need to test the registration flow multiple times on the same event with your Attendee account:
1. On **Account A (Organizer)**:
   - Open event dashboard -> **Attendees**.
   - Locate Account B -> Tap **Cancel Registration** / **Remove Attendee**.
2. On **Account B (Attendee)**:
   - Refresh the event page. The "Get Ticket" button will be active again.

### B. Testing QR Code Ticket Check-in
1. On **Account B (Attendee)**:
   - Open **My Tickets** -> Select the active event pass -> Display the QR code on screen.
2. On **Account A (Organizer / Check-in Officer)**:
   - In event dashboard, tap **Check-in Scanner** (or open the dedicated scanner deep link).
   - Grant camera permissions and scan the QR code on Account B's screen.
   - **Verify:**
     - First scan: Green success banner with attendee name and ticket tier.
     - Second scan (Duplicate test): Red warning banner showing "Already Checked In" with timestamp.
