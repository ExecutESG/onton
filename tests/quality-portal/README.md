# ONTON End-to-End Quality & Growth Readiness Portal

The **ONTON Quality Portal** provides executive-level and engineer-level visibility into all user flows, automated test executions, screenshot evidence, recorded videos, and API coverage across the ONTON platform.

## Features

- **100% Growth & Marketing Readiness Matrix**:
  - Verification across all 6 platform user roles:
    1. **Guest / Visitor**: Discovery, multi-filter search, channel browsing, tournament leaderboards, landing pages, authentication gating.
    2. **Registered User**: Native TMA session, TonConnect Web3 wallet, free event RSVP, paid tickets, coupons, ticket passes, quests, points engine.
    3. **Event Organizer**: Hosted events hub, multi-step creation wizard with custom questionnaire builder, management dashboard, guest list, and CSV export.
    4. **Check-in Officer**: QR code ticket scanner API, scoped attendee guest list, duplicate scan prevention.
    5. **Platform Admin**: Client Web Panel authentication, admin role elevation, system health.
    6. **Partner & Affiliate**: Referral link generation (`join-[hash]`), deep link attribution tracking.
- **Visual Evidence Center**:
  - Embedded high-resolution screenshots for each flow.
  - Video recordings of automated browser interactions across Desktop and Mobile viewports.
- **API & Router System Coverage**:
  - Full matrix of all 32 tRPC modules and Next.js handlers validated with 200 OK responses.
- **Exportable Reports**:
  - One-click export to structured JSON.
  - Formatted printable audit report.

## Launching the Portal

### Option 1: Local HTTP Server (Recommended)
From the repository root:
```bash
cd tests/e2e
npm run portal
```
Then open your browser to: **[http://localhost:4000](http://localhost:4000)**

### Option 2: Direct File Open
You can open `tests/quality-portal/index.html` directly in any modern web browser (Chrome, Brave, Safari, Firefox). Zero external build or server required.

## Running Tests & Updating the Portal Data
To re-run the entire Playwright test suite and automatically regenerate all test metrics, screenshots, and video recordings:
```bash
cd tests/e2e
npm run test:quality
```
This will:
1. Run all 74 test scenarios across Desktop Chromium and Mobile Pixel 5.
2. Record video sessions and save screenshots to `test-results/`.
3. Update `tests/quality-portal/data.js` and `data.json` with the latest test execution results.
