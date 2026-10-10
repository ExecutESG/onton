# ONTON Project Goals: Q2 2026 Roadmap

> Last verified against dev: 2026-10-03

**Theme:** "Aggressive Growth & Decentralization"

> [!NOTE]
> This is a business roadmap. Items here are goals, not implemented features, unless marked **(on dev)**. For current code see [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md); for concrete work see [TASKS.md](TASKS.md).

## 🧱 Goal 1: Technical Stability (The Foundation)
**Objective:** Handle high traffic without degradation.
*   **KR 1.1 — Refactor core routers:** Split `events.ts` (~46 KB) and `campaignRouter.ts` (~24 KB) into testable services.
*   **KR 1.2 — Event-driven money flows:** Payments are verified by a TonCenter polling cron (every 7 s) and minted by a cron (every 9 s). An `order_paid` RabbitMQ queue and consumer exist **(on dev)** but the consumer is likely failing (F-35). Goal: a working event path with the cron as fallback.
*   **KR 1.3 — Automated QA:** >80% integration coverage for create order → pay → mint → check-in. Today: Vitest (`yarn test:api`) and lint run in CI; Playwright smoke runs after deploy **(on dev)**.
*   **KR 1.4 — Operations:** automated prod DB backups and an automated prod deploy (neither exists today).

## 📣 Goal 2: Reactivate & Multiply Organizers (The Engine)
**Objective:** Re-engage past organizers and help them host more events.
*   **KR 2.1 — Win-back features:** "One-Click Duplicate Event" (not implemented), simpler Telegram broadcasting to attendees.
*   **KR 2.2 — "Organizer Pro" tools:** analytics (sales, show-rates).
*   **KR 2.3 — Community hubs:** persistent organizer profile pages independent of single events.

## 📈 Goal 3: Drive Traffic (The Fuel)
**Objective:** User acquisition, using the ONION token.
*   **KR 3.1 — Web discovery:** SEO-friendly public event pages. Web login (email OTP, Google) and account linking exist **(on dev)**; `website/` has event, sitemap and robots routes **(on dev)**.
*   **KR 3.2 — Viral loops:** "Share-to-Earn" on top of the affiliate system. Affiliate links exist **(on dev)**; purchases are counted only on the TON/jetton path.
*   **KR 3.3 — Cross-community quests:** joint campaigns with TON projects.

## 🗳️ Goal 4: Decentralized Decision Making (The Future)
**Objective:** Let the community steer the platform. Nothing here is implemented.
*   **KR 4.1 — Governance portal:** proposal and voting UI in the Mini App.
*   **KR 4.2 — Snapshot integration:** ONION holdings as voting power.
*   **KR 4.3 — Transparency dashboard:** treasury usage and platform metrics.

## 🧅 Cross-Cutting: ONION Token Utility
**Objective:** Increase demand and utility. Ideas (none implemented):
*   *Organizers:* stake ONION to unlock "Pro" analytics or feature events.
*   *Traffic:* spend ONION to boost events on the homepage.
*   *Governance:* vote weight = ONION held.

---

## 📅 Execution Roadmap

| Month | Focus | Key Deliverable |
| :--- | :--- | :--- |
| **Month 1** | **Stability** | Backups, payment fixes, router refactor start. |
| **Month 2** | **Organizers & Ops** | Automated prod deploy, "Organizer Pro" analytics, Duplicate Event. |
| **Month 3** | **Traffic & Governance** | SEO launch, referral campaign, governance research. |
