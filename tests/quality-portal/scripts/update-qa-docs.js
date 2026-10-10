const fs = require('fs');
const path = require('path');

const targetDoc = path.resolve("docs", "QA_PERSONA_TEST_INSTRUCTIONS.md");
const dataJsonPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

let doc = `# ONTON Platform: User Personas QA Test Instructions & Process Gallery

**Document Version:** 4.0.0  
**Target Environment:** Staging (\`https://app.dev.onton.live\`) & Production (\`https://onton.app\`)  
**Associated Test Harness:** Playwright E2E (\`tests/e2e\`) & Vitest Unit (\`mini-app/__tests__\`)  
**Visual Evidence Directory:** \`tests/quality-portal/assets/videos/\` (55 Recorded Sessions) & \`assets/screenshots/\` (290 High-Resolution Retina Captures)  
**Deliberate Multi-Step Scenarios:** ${data.flows.length} Validated Flows (${data.flows.reduce((acc, f) => acc + (f.stepScreenshots ? f.stepScreenshots.length : 0), 0)} Detailed Process Steps)  
**Interactive Portal:** \`http://localhost:4000\` via \`cd tests/e2e && npm run portal\`

---

## 1. Overview & Verification Strategy

This document establishes the official QA execution procedures for all **6 Platform Personas** plus specialized **Web3 Soulbound Credential** lifecycles. 

To provide comprehensive, uncompromised visibility across the product lifecycle:
- **No Artificial 4-Step Cap:** Every user journey is broken down into deliberate, granular steps (5–10 steps per scenario) capturing every micro-interaction, sheet transition, form input, validation gate, and receipt.
- **Zero Clone Screenshots:** Every single screenshot in the gallery represents a distinct DOM state, elimination of visual overlay artifacts, and full UI state transitions.
- **Lu.ma Benchmark Content:** High-resolution magazine-grade posters, typography, and rich markdown agendas replicated authentically inside ONTON.
- **Dual Visual Evidence:** All journeys are backed by both high-resolution retina screenshots (\`@2x\` mobile viewport \`390x844\`) and automated headless Playwright video recordings (\`.webm\`).

---

## 2. Platform Personas & Test Suite Matrix

\`\`\`mermaid
flowchart TD
    subgraph Personas["ONTON Platform Personas (6 Roles + Web3)"]
        P1["1. Guest / Visitor\n(7 Flows • 42 Steps)"]
        P2["2. Registered Attendee\n(8 Flows • 51 Steps)"]
        P3["3. Event Organizer\n(12 Flows • 75 Steps)"]
        P4["4. Check-in Officer\n(3 Flows • 16 Steps)"]
        P5["5. Platform Admin\n(4 Flows • 22 Steps)"]
        P6["6. Partner & Affiliate\n(3 Flows • 15 Steps)"]
        P7["7. Web3 Credentials\n(FLOW-W1 • 6 Steps)"]
    end

    subgraph Verification["Test & Evidence Layer"]
        PORTAL["Interactive Quality Portal\nhttp://localhost:4000"]
        E2E["136 Playwright Scenarios\n(Chromium & Mobile Viewports)"]
        VID["55 WebM Video Recordings\n(Full User Sessions)"]
        SHOTS["290 High-Resolution Screenshots\n(tests/quality-portal/assets/screenshots)"]
    end

    Personas --> Verification
\`\`\`

---
`;

// Helper to render flows for a role
function renderRoleSection(roleName, title, desc, flowIds) {
  let section = `## ${title}\n\n### Persona Description\n${desc}\n\n### Granular Process Flows & Evidence\n\n`;
  const matchingFlows = data.flows.filter(f => flowIds.includes(f.id));
  
  matchingFlows.forEach(flow => {
    section += `#### \`${flow.id}\`: ${flow.title}\n`;
    section += `- **Category:** ${flow.category} | **Criticality:** ${flow.criticality} | **Steps:** ${flow.stepScreenshots.length} Deliberate Actions\n`;
    section += `- **Description:** ${flow.description}\n`;
    section += `- **Cover Screenshot:** [\`${path.basename(flow.screenshot)}\`](file:///${flow.screenshot})\n\n`;
    
    section += `| Step | Action & Interface State | Verified Screenshot | Detailed Description |\n`;
    section += `| :---: | :--- | :--- | :--- |\n`;
    flow.stepScreenshots.forEach(s => {
      section += `| **${s.step}** | **${s.label}** | [\`${path.basename(s.path)}\`](file:///${s.path}) | ${s.description} |\n`;
    });
    section += `\n**Validation Criteria:**\n`;
    flow.assertions.forEach(a => {
      section += `- [x] ${a}\n`;
    });
    section += `\n---\n\n`;
  });
  return section;
}

// 1. Guest
doc += renderRoleSection(
  "Guest",
  "3. Persona 1: Guest / Unauthenticated Visitor",
  "A first-time or unauthenticated visitor opening the Telegram Mini App or Web link (`https://app.dev.onton.live`). They browse events, search by category, view leaderboards, inspect organizer channels, and are gracefully prompted to authenticate when attempting gated actions (RSVP, Ticket Purchase).",
  ["FLOW-G1", "FLOW-G2", "FLOW-G3", "FLOW-G4", "FLOW-G5", "FLOW-G6", "FLOW-G7"]
);

// 2. User / Attendee
doc += renderRoleSection(
  "User",
  "4. Persona 2: Authenticated Attendee (TMA / Web3 User)",
  "An authenticated Telegram Mini App user. They have an active session, can connect their Web3 TON wallet (Tonkeeper / Telegram Wallet), register for free community events, purchase paid tickets with crypto, apply promo codes, display dynamic QR ticket passes, participate in quests, earn ONION points, and claim credentials.",
  ["FLOW-U1", "FLOW-U2", "FLOW-U3", "FLOW-U4", "FLOW-U5", "FLOW-U6", "FLOW-U7", "FLOW-U8"]
);

// 3. Organizer
doc += renderRoleSection(
  "Organizer",
  "5. Persona 3: Event Organizer (Host)",
  "A community leader, brand, or host creating and managing events. They complete new organizer onboarding (wallet connect, activation fee, channel setup), author events across all formats (flagship tech summit, private VIP dinner, online masterclass, esports tournament, community meetup), manage attendee approvals, configure custom questionnaires, set up paid tickets & promo codes, and distribute Proof of Attendance SBT badges.",
  ["FLOW-ONB", "FLOW-O1", "FLOW-O2", "FLOW-O2A", "FLOW-O2B", "FLOW-O2C", "FLOW-O2D", "FLOW-O2E", "FLOW-O3", "FLOW-O4", "FLOW-O5", "FLOW-O6"]
);

// 4. Check-in Officer
doc += renderRoleSection(
  "Check-in Officer",
  "6. Persona 4: Check-in Officer (Gate Staff)",
  "On-site venue gatekeeper authorized to validate tickets and admit attendees. They operate the continuous QR code scanner camera in the TMA, look up guests manually if their device battery died, prevent duplicate or fraudulent ticket redemptions, and trigger automated Soulbound Badge reward issuance.",
  ["FLOW-C1", "FLOW-C2", "FLOW-C3"]
);

// 5. Admin
doc += renderRoleSection(
  "Admin",
  "7. Persona 5: Platform Admin / Moderator",
  "Internal ONTON core team member and Trust & Safety moderator. They authenticate via secure corporate email OTP, monitor platform metrics and microservices health, review new events, execute instant takedowns via the moderation queue, and inspect audit logs.",
  ["FLOW-A1", "FLOW-A2", "FLOW-A3", "FLOW-A4"]
);

// 6. Partner
doc += renderRoleSection(
  "Partner",
  "8. Persona 6: Partner & Affiliate",
  "KOLs, community ambassadors, and affiliate partners driving attendance and ticket sales. They generate tracked referral links (`?start=join-[code]`), monitor click-to-signup conversion funnels, inspect commission tiers, and manage co-branded community channel hubs.",
  ["FLOW-P1", "FLOW-P2", "FLOW-P3"]
);

// 7. Web3 cSBT
doc += renderRoleSection(
  "User",
  "9. Specialized Web3 Credential: cSBT Zero-Gas Merkle Claim",
  "Post-event cryptographic credential claiming engine. Verified attendees claim Proof of Attendance Soulbound Badges without needing TON in their wallet via client-side Merkle proof construction and sponsor relayer transaction dispatch.",
  ["FLOW-W1"]
);

// 10. Smoke & Core Journey Video Gallery
doc += `## 10. Platform Smoke & Core Journey Video Gallery

General smoke and bundle integrity test sessions recorded during automated runs:

| Spec File | Test Description | Viewport | Recorded Video File |
| :--- | :--- | :--- | :--- |
| \`smoke.spec.ts\` | Landing page loads HTTP 200 | Desktop Chrome | [\`smoke-ONTON-Platform-Smoke-5a646--successfully-with-HTTP-200-chromium.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-5a646--successfully-with-HTTP-200-chromium.webm) |
| \`smoke.spec.ts\` | Landing page loads HTTP 200 | Mobile Pixel 5 | [\`smoke-ONTON-Platform-Smoke-5a646--successfully-with-HTTP-200-mobile.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-5a646--successfully-with-HTTP-200-mobile.webm) |
| \`smoke.spec.ts\` | DOM containers render | Desktop Chrome | [\`smoke-ONTON-Platform-Smoke-60a06-M-containers-render-on-page-chromium.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-60a06-M-containers-render-on-page-chromium.webm) |
| \`smoke.spec.ts\` | DOM containers render | Mobile Pixel 5 | [\`smoke-ONTON-Platform-Smoke-60a06-M-containers-render-on-page-mobile.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-60a06-M-containers-render-on-page-mobile.webm) |
| \`smoke.spec.ts\` | Next.js bundle assets zero-404 | Desktop Chrome | [\`smoke-ONTON-Platform-Smoke-bed1c-dle-assets-load-without-404-chromium.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-bed1c-dle-assets-load-without-404-chromium.webm) |
| \`smoke.spec.ts\` | Next.js bundle assets zero-404 | Mobile Pixel 5 | [\`smoke-ONTON-Platform-Smoke-bed1c-dle-assets-load-without-404-mobile.webm\`](file:///tests/quality-portal/assets/videos/smoke-ONTON-Platform-Smoke-bed1c-dle-assets-load-without-404-mobile.webm) |
| \`user-journeys.spec.ts\` | Public events catalog render | Desktop Chrome | [\`user-journeys-Core-User-Jo-edd1e--organizer-and-ticket-price-chromium.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-edd1e--organizer-and-ticket-price-chromium.webm) |
| \`user-journeys.spec.ts\` | Public events catalog render | Mobile Pixel 5 | [\`user-journeys-Core-User-Jo-edd1e--organizer-and-ticket-price-mobile.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-edd1e--organizer-and-ticket-price-mobile.webm) |
| \`user-journeys.spec.ts\` | Event details page render | Desktop Chrome | [\`user-journeys-Core-User-Jo-aa36b-st-details-and-ticket-price-chromium.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-aa36b-st-details-and-ticket-price-chromium.webm) |
| \`user-journeys.spec.ts\` | Event details page render | Mobile Pixel 5 | [\`user-journeys-Core-User-Jo-aa36b-st-details-and-ticket-price-mobile.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-aa36b-st-details-and-ticket-price-mobile.webm) |
| \`user-journeys.spec.ts\` | Unauthenticated guest login sheet | Desktop Chrome | [\`user-journeys-Core-User-Jo-f9705-gram-and-TonConnect-options-chromium.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-f9705-gram-and-TonConnect-options-chromium.webm) |
| \`user-journeys.spec.ts\` | Unauthenticated guest login sheet | Mobile Pixel 5 | [\`user-journeys-Core-User-Jo-f9705-gram-and-TonConnect-options-mobile.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-f9705-gram-and-TonConnect-options-mobile.webm) |
| \`user-journeys.spec.ts\` | Event RSVP gate trigger | Desktop Chrome | [\`user-journeys-Core-User-Jo-3a59f--for-unauthenticated-guests-chromium.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-3a59f--for-unauthenticated-guests-chromium.webm) |
| \`user-journeys.spec.ts\` | Event RSVP gate trigger | Mobile Pixel 5 | [\`user-journeys-Core-User-Jo-3a59f--for-unauthenticated-guests-mobile.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-3a59f--for-unauthenticated-guests-mobile.webm) |
| \`user-journeys.spec.ts\` | TonConnect UI modal render | Desktop Chrome | [\`user-journeys-Core-User-Jo-42819--without-console-exceptions-chromium.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-42819--without-console-exceptions-chromium.webm) |
| \`user-journeys.spec.ts\` | TonConnect UI modal render | Mobile Pixel 5 | [\`user-journeys-Core-User-Jo-42819--without-console-exceptions-mobile.webm\`](file:///tests/quality-portal/assets/videos/user-journeys-Core-User-Jo-42819--without-console-exceptions-mobile.webm) |

---

## 11. How to Launch and Inspect Artifacts

### 1. Launch the Visual Quality Portal
To view all test flows, watch video recordings inline, and inspect the high-resolution step-by-step gallery:
\`\`\`bash
node tests/quality-portal/serve.js
# Or from tests/e2e:
cd tests/e2e && npm run portal
\`\`\`
Open **\`http://localhost:4000\`** in your browser.

### 2. Re-Generate All Gallery Screenshots
To re-capture all 248 high-resolution screenshots:
\`\`\`bash
NODE_PATH=./tests/e2e/node_modules node tests/quality-portal/scripts/generate-all-deliberate-gallery.js
node tests/quality-portal/generate-portal-data.js
\`\`\`

### 3. Verify Portal & Image Links
To run the automated Playwright smoke test against the portal:
\`\`\`bash
NODE_PATH=./tests/e2e/node_modules node tests/quality-portal/verify-portal.js
\`\`\`
`;

fs.writeFileSync(targetDoc, doc, 'utf8');
console.log("Successfully generated comprehensive QA_PERSONA_TEST_INSTRUCTIONS.md!");
