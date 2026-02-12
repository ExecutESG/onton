# ONTON Prioritized Task List (Q2 2026)

This list bridges the gap between our **Business Goals** ([PROJECT_GOALS.md](PROJECT_GOALS.md)) and our **Technical Reality** ([SYSTEM_AUDIT.md](SYSTEM_AUDIT.md)).

## 🚨 Critical Path (Objective #1: Technical Stability)

*Code Debt Blocking Scale & Stability.*

| Priority | Task | Impact Breakdown | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **Refactor `events.ts` Router** | **Stability**: The 42KB+ file is a Single Point of Failure. If this breaks, no one can host event. Needs to be split into `EventService` and `EventController`. | 5 Days |
| **HIGH** | **Migrate Payment Polling to Events** | **Stability/Scale**: Current Cron jobs poll the DB every minute. This will choke under "Huge Traffic". Moving to RabbitMQ (`amqplib`) ensures instant ticket minting. | 3 Days |
| **HIGH** | **Integration Test Suite (Payments)** | **Stability**: We cannot risk bugs in money flows. Need vitest coverage for `Create Order` -> `Payment Webhook` -> `Mint NFT`. | 4 Days |
| **MED** | **Centralize RBAC Logic** | **Security**: Permissions are scattered in `trpc.ts`. As we add "Organizer Pro" roles, this needs to be a dedicated `AccessControlService`. | 2 Days |

---

## 🍏 Low-Hanging Fruit (Objective #2: Reactivate Organizers)

*Quick wins to unlock value for existing users.*

| Priority | Task | Impact Breakdown | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **"Duplicate Event" Button** | **Activation**: Removes friction for recurring event hosts. Simple add to `events.ts` router. | 0.5 Days |
| **MED** | **Organizer Analytics Dashboard** | **Activation**: Show "Total Ticket Sales" and "Page Views". Data already exists in `orders` and `views` tables; just front-end work. | 2 Days |
| **LOW** | **Direct Telegram Broadcast** | **Activation**: Expose the existing `admin.composer.ts` logic to Allow organizers to message *their* attendees. | 1.5 Days |

---

## 🚀 Growth & Traffic (Objective #3)

| Priority | Task | Impact Breakdown | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **Hybrid Auth Implementation** | **Traffic**: The bridge to the "Unified Web Platform". Allow users to login via Google/Email and link their Telegram. | 5 Days |
| **HIGH** | **SEO-Optimized Event Pages** | **Traffic**: Render event details on the server (Next.js SSR) with proper OpenGraph tags for social sharing. | 3 Days |
| **MED** | **Affiliate "Share-to-Earn" UI** | **Viral Loop**: Frontend component to generate referral links and show ONION rewards. | 2 Days |

---

## 🗳️ Governance (Objective #4)

| Priority | Task | Impact Breakdown | Effort |
| :--- | :--- | :--- | :--- |
| **MED** | **Snapshot.org Integration Strategy** | **Decentralization**: Research if we use off-chain Snapshot or build on-chain voting. | 1 Day |
| **LOW** | **In-App Voting UI** | **Engagement**: Simple UI to display active proposals and capture votes (signed by wallet). | 3 Days |

---

## 📅 Monthly Execution Plan

*   **Month 1**: Critical Path Refactors + "Duplicate Event" + Analytics Dashboard.
*   **Month 2**: Hybrid Auth + SEO Pages + Payment Queue Migration.
*   **Month 3**: Governance UI + Affiliate System Polish.
