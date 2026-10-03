# ONTON Core Interactions

> Last verified against dev: 2026-10-03

Index of the main user flows and where each is documented.

| # | Flow | Actor | Doc |
|---|---|---|---|
| 1 | Onboarding & login | User | [user_onboarding.md](user_onboarding.md), [workflow_auth.md](workflow_auth.md) |
| 2 | Organizer upgrade | User → Organizer | below, [payment_system_overview.md](payment_system_overview.md) |
| 3 | Event creation | Organizer | [event_creation.md](event_creation.md) |
| 4 | Registration / ticket purchase | Participant | [workflow_event_lifecycle.md](workflow_event_lifecycle.md), [payment_system_overview.md](payment_system_overview.md) |
| 5 | Check-in & PoA | Event managers, participant | [checkin_and_poa.md](checkin_and_poa.md) |
| 6 | Rewards (SBT / NFT) | System, participant | [reward_distribution.md](reward_distribution.md) |
| 7 | Affiliate | Affiliate, participant | [affiliate_system.md](affiliate_system.md) |

## 1. Onboarding
- Entry: the Mini App (links `https://t.me/<bot>/event?startapp=<eventUuid>`), the bot, or the web app.
- TMA users are identified by signed initData and upserted on each request. Web users log in with the Telegram widget, Google, or email OTP.
- Wallet: TON Connect + `users.addWallet`.

## 2. Organizer upgrade
- Automatic: a `user` becomes `organizer` when they create their first event (`addEvent`).
- Paid path: `promote_to_organizer` order type, processed by the `OrganizerPromoteProcessing` cron (every 21s) in the payment worker.

## 3. Event creation
- Free events publish immediately with a post-publish moderation alert.
- Paid events stay hidden until the organizer pays the `event_creation` order; the NFT collection is then deployed.

## 4. Registration / purchase
- Free with registration: `registrant.eventRegister` (approval and waitlist supported).
- Paid: `POST /api/v1/order`, then TON/USDT transfer with memo `onton_order=<id>` or Telegram Stars invoice. TON/USDT orders are fulfilled by the mint cron (NFT ticket); Stars orders are completed by the bot without an NFT.

## 5. Check-in & PoA
- In-person: an event manager scans the attendee's rotating QR pass (20s step) in the mini-app.
- Online (no registration): attendee enters the organizer's secret phrase during the event window.

## 6. Rewards
- Native SBTs are minted at ticket check-in (if a wallet is linked) or claimed by the ticket owner; an on-chain upgrade is paid.
- TON Society reward batches run only when `ENABLE_TON_SOCIETY=true`.
- `notifyUsersForRewards` sends reward notifications.

## 7. Affiliate
- Links: `t.me/<bot>/event?startapp=join-<hash>`; the hash is read from initData `start_param`.
- `affiliate_links.total_clicks` and `total_purchase` are tracked. Purchases are counted only on the TON/USDT mint path (not Stars or free orders).
