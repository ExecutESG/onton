# ONTON Prioritized Task List (Q2 2026)

> Last verified against dev: 2026-10-03

Links **business goals** ([PROJECT_GOALS.md](PROJECT_GOALS.md)) to the **current code** ([SYSTEM_AUDIT.md](SYSTEM_AUDIT.md)). Effort numbers are estimates.

## Status of 2.0 (already on `dev`)
- Hybrid auth: email OTP, Google, Telegram widget and account linking (`user_identities`) are implemented. `POST /api/v1/auth/link` accepts only `telegram` (initData) and `email` (OTP). "Link Google" uses the authenticated `usersGoogle.getAuthUrl` flow.
- Moderation moved into `telegram-bot`; free events auto-publish with post-publish moderation.
- Ticket check-in is event-manager only; QR passes rotate (static UUIDs rejected at the scan step).
- `sbt.mintBadge` is global-admin only; `claimAttendanceSbt` / `materializeOnChainSbt` are ticket-owner only.
- Order retries: `retry_count` / `last_error`, `failed` after 5 attempts.

## 🚨 Critical path (Objective #1: Technical stability)

| Priority | Task | Why | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **Automated prod DB backups** | There are none today; only manual dumps. | 1 Day |
| **HIGH** | **Fix the `order_paid` consumer** | The queue and consumer exist (`mini-app/src/workers/orderPaidConsumer.ts`) but the consumer likely fails to start (F-35). Fulfillment runs on the 9 s mint cron. | 1 Day |
| **HIGH** | **Stars payment validation** | Pre-checkout approves without checking order, price or capacity (F-33). | 1 Day |
| **HIGH** | **Paid tier inventory** | Paid sales do not increment tier `sold_count`; no tier-creation API (F-34). | 2 Days |
| **HIGH** | **Automated prod deploy** | CI deploys `main` to the staging host (F-04). | 2 Days |
| **HIGH** | **Refactor `events.ts` router** | ~46 KB file mixing validation, DB and logic. Split into a service plus thin router. | 5 Days |
| **HIGH** | **Payment integration tests** | Vitest coverage for create order → TonCenter verification (`CheckTransactions`) → mint (`MintNFTForPaidOrders`). There is no payment webhook; verification is polling. | 4 Days |
| **MED** | **Centralize RBAC** | Checks are in `src/server/trpc.ts` + `accessRolesPathConfig.ts`; the co-organizer procedure is not scoped to one event. | 2 Days |
| **MED** | **Remove PoA universal override** | F-30. | 0.5 Days |
| **MED** | **Send OTP emails** | OTP codes are logged, not emailed (F-27). | 1 Day |
| **MED** | **SBT pricing rule** | Free SBT at check-in/claim vs paid on-chain upgrade (F-36). | 1 Day |

---

## 🍏 Low-hanging fruit (Objective #2: Reactivate organizers)

| Priority | Task | Notes | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **"Duplicate Event" button** | Not implemented. Add to `events.ts`. | 0.5 Days |
| **MED** | **Organizer analytics dashboard** | Sales data exists in `orders`. View tracking source to be confirmed. | 2 Days |
| **LOW** | **Organizer broadcast to attendees** | The bot has a `/broadcast` command (`telegram-bot/src/composers/broadcast.ts`). Expose a version scoped to an organizer's own attendees. | 1.5 Days |

---

## 🚀 Growth & traffic (Objective #3)

| Priority | Task | Notes | Effort |
| :--- | :--- | :--- | :--- |
| **HIGH** | **SEO event pages** | `website/` already has `events`, `sitemap`, `robots` routes. Extend with server-rendered OpenGraph tags. | 3 Days |
| **MED** | **Affiliate "Share-to-Earn" UI** | Link generation exists (`affiliateRouter.ts`, `tasksRouter.ts`). Purchases are counted only on the TON/jetton mint path, not Stars or free orders. | 2 Days |

---

## 🗳️ Governance (Objective #4) — not implemented

| Priority | Task | Notes | Effort |
| :--- | :--- | :--- | :--- |
| **MED** | **Snapshot.org integration strategy** | Research off-chain Snapshot vs on-chain voting. | 1 Day |
| **LOW** | **In-app voting UI** | Show proposals, capture wallet-signed votes. | 3 Days |

---

## 📅 Monthly plan
- **Month 1**: Backups, payment fixes (F-33, F-34, F-35), PoA override removal, "Duplicate Event".
- **Month 2**: Automated prod deploy, `events.ts` refactor, payment tests, analytics dashboard.
- **Month 3**: SEO pages, affiliate UI, governance research.
