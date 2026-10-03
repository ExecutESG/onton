# ONTON Production Release Candidate: Manual UAT Checklist (Gate G6)

**Target Environment:** Staging Bot [`@notnonstagebot`](https://t.me/notnonstagebot) • Web [`https://app.dev.onton.live`](https://app.dev.onton.live)  
**Strict Safety Guardrail:** All test scenarios in Sections 1–4 MUST run on `@notnonstagebot`. Never perform manual tests or test mutations on production bot `@theontonbot`.

---

## Tester & Execution Metadata

| Field | Tester Input |
| :--- | :--- |
| **Tester Name** | |
| **Execution Date** | |
| **Primary Device 1 (iOS)** | iPhone Model: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; iOS Version: |
| **Primary Device 2 (Android)** | Android Model: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Android Version: |
| **Telegram App Version** | |
| **Tonkeeper App Version** | Network: [ ] Testnet enabled (for Staging UAT) |

---

## 1. Event Organizer Persona (`UAT-ORG`)

Scenarios cover native bot commands, Telegram group linking, Tonkeeper testnet onboarding, and forum channel notifications that cannot be automated in browser tests.

| ID | Ref | Preconditions | Steps | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-ORG-01** | `telegram-bot/src/composers/groupComposer.ts` | 1. Organizer account on `@notnonstagebot`<br>2. Has created an upcoming event<br>3. Owns a private test Telegram group | 1. Add `@notnonstagebot` as Administrator in private test group with "Invite Users via Link" rights.<br>2. Open DM with `@notnonstagebot` and send `/invitor`.<br>3. Tap event button from inline keyboard, confirm with "Yes".<br>4. Paste numeric group ID (e.g. `-100...`). | Bot confirms group linked successfully; saves `event_telegram_group` to database. | [ ] Pass<br>[ ] Fail | |
| **UAT-ORG-02** | `telegram-bot/src/handlers/starsPaymentHandler.ts` | 1. Group linked via `UAT-ORG-01`<br>2. Attendee A registered/approved<br>3. Second test account (Attendee B) ready | 1. Attendee A receives one-time invite link in bot DM.<br>2. Attendee A taps link and joins the private group.<br>3. Attendee B taps the identical invite link. | Attendee A joins group; Attendee B is rejected with Telegram error: "The invite link has expired or reached member limit". | [ ] Pass<br>[ ] Fail | |
| **UAT-ORG-03** | `mini-app/src/app/_components/organisms/ConnectWallet.tsx` | 1. Organizer on phone without active organizer status<br>2. Tonkeeper installed, switched to Testnet, funded with >= 1.0 testnet TON | 1. Open `@notnonstagebot` TMA -> Profile -> Onboarding card.<br>2. Tap "Connect TON Wallet" -> select Tonkeeper.<br>3. Approve connection in Tonkeeper app and return to TMA.<br>4. Tap "Pay Activation Fee (1.00 TON)".<br>5. Confirm 1.00 TON transfer in Tonkeeper. | Tonkeeper signs transfer, TMA updates to onboarded state, verified badge displays, and floating "+" create FAB appears. | [ ] Pass<br>[ ] Fail | |
| **UAT-ORG-04** | `mini-app/src/lib/tgBot.ts` | 1. Organizer account ready<br>2. Access to ONTON internal staging forum group (`LOGS_GROUP_ID`) | 1. In TMA, create and publish a new event.<br>2. Open the staging forum group (`-1002264975789`).<br>3. Navigate to Topic 2 (`events_topic`). | Automated announcement appears in Topic 2 showing event title, organizer handle, and event UUID. Zero spillage to General. | [ ] Pass<br>[ ] Fail | |

---

## 2. Attendee Persona (`UAT-ATT`)

Scenarios cover native Telegram Stars checkout sheet, Tonkeeper testnet payments, rotating anti-fraud TOTP passes, on-chain SBT minting, story sharing, and in-app browser identity linking.

| ID | Ref | Preconditions | Steps | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-ATT-01** | `mini-app/src/app/events/[hash]/checkout/_components/CheckoutForm.tsx` | 1. Attendee on `@notnonstagebot`<br>2. Event published with ticket tier priced in Stars (e.g. 5 Stars) | 1. Open event in TMA -> tap "Get Ticket" -> pick Stars tier.<br>2. Select "Telegram Stars" payment rail -> tap "Pay with Stars".<br>3. Native Telegram Stars payment sheet slides up over TMA.<br>4. Confirm payment in Telegram sheet (sandbox test mode). | Native sheet dismisses; TMA shows "Payment successful!" toast; redirects to `/tickets/[eventUuid]`; ticket status is ACTIVE. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-02** | `telegram-bot/src/handlers/starsPaymentHandler.ts` | 1. Stars or Crypto ticket purchased on event with linked Telegram group | 1. Complete ticket purchase in TMA.<br>2. Switch from TMA to `@notnonstagebot` direct message thread. | Bot sends DM: "🎉 Payment Received!", includes event title, `[🎟 View My Ticket]` webApp button, and `[💬 Join Event Chat]` one-time invite button. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-03** | `mini-app/src/cronJobs/tasks/CheckTransactions.ts` | 1. Real phone with Tonkeeper Testnet active<br>2. Wallet funded with >= 0.5 testnet TON from `@testgiver_ton_bot` | 1. In TMA checkout, select "Crypto (TON)" payment rail.<br>2. Tap "Connect TON Wallet" -> select Tonkeeper -> approve in app.<br>3. Tap "Pay with TON".<br>4. Tonkeeper opens with transfer sheet and comment `onton_order=<uuid>`.<br>5. Sign transaction in Tonkeeper. | Transaction broadcasts on testnet; payment worker reconciles order within 10s; TMA shows order completed and unlocks ticket pass. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-04** | `mini-app/src/app/tickets/[id]/qrcode/page.tsx` | 1. Attendee has active ticket pass for upcoming event | 1. In TMA, open "My Tickets" -> tap ticket pass -> tap "Show QR Code".<br>2. View `/tickets/[id]/qrcode` full-screen page.<br>3. Watch green "Live Anti-Fraud Pass" indicator and 20s ticker for 30s. | Countdown ticks down from 20s to 1s; QR canvas visually refreshes every 20s with new HMAC token (`ONTON:v1:<uuid>:<step>:<sig>`). | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-05** | `mini-app/src/app/tickets/[id]/_components/AttendanceCredentials.tsx` | 1. Attendee checked in to event<br>2. Tonkeeper testnet wallet connected | 1. Open ticket page `/tickets/[id]`.<br>2. Confirm Tier 1 "Proof of Attendance (cSBT) - Zero Gas • Active" displays Merkle root.<br>3. Tap Tier 2 "Upgrade to On-Chain SBT (0.1 TON)".<br>4. Sign 0.1 TON transfer in Tonkeeper.<br>5. On completion, tap "View in TON Explorer". | Browser opens `https://testnet.tonviewer.com/<address>`; shows minted Soulbound NFT bound to attendee address with immutable metadata. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-06** | `mini-app/src/components/sbt/BadgeDetailModal.tsx` | 1. Attendee has claimed or minted attendance badge | 1. Open badge modal in `/my/badges` or `/tickets/[id]`.<br>2. Tap "Share to Story".<br>3. Inspect Telegram Story composer screen. | Telegram native Story editor opens with event badge art sticker, default caption, and clickable link widget to `@notnonstagebot`. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-07** | `mini-app/src/app/_components/auth/LinkedAccountsCard.tsx` | 1. Attendee logged in via Telegram TMA<br>2. Valid Google account available | 1. Open Profile tab `/my` -> scroll to "Connected Accounts" card.<br>2. Verify Telegram shows green checkmark.<br>3. Tap "Connect" next to Google.<br>4. In Telegram in-app browser, complete Google OAuth sign-in.<br>5. Return to TMA `/my` page. | Page updates; both Telegram and Google display green checkmark `[Connected]` with linked email address. | [ ] Pass<br>[ ] Fail | |
| **UAT-ATT-08** | `mini-app/src/app/_components/auth/LinkedAccountsCard.tsx` | 1. Two identities linked from `UAT-ATT-07` (Telegram + Google) | 1. In Connected Accounts card, tap "Unlink" icon next to Google -> confirm.<br>2. Verify Google unlinks and status reverts to "Not linked".<br>3. Tap "Unlink" next to remaining Telegram provider. | Google unlinks cleanly; unlinking remaining Telegram provider is blocked with error toast: "Cannot unlink your only login method." | [ ] Pass<br>[ ] Fail | |

---

## 3. Check-in Officer Persona (`UAT-CHK`)

Scenarios cover native phone camera QR scanning, haptic feedback, duplicate scan rejection, and expired TOTP pass defense.

| ID | Ref | Preconditions | Steps | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-CHK-01** | `mini-app/src/app/_components/Event/ScanRegistrantQRCode.tsx` | 1. Check-in Officer on real phone<br>2. Authorized on event guest list<br>3. Attendee phone displays live QR pass | 1. In TMA event dashboard, tap Check-in Scanner icon (`ScanLine`).<br>2. Grant native Telegram camera permission.<br>3. Point phone camera at Attendee's dynamic QR code screen. | Camera locks instantly; phone vibrates with success haptic feedback; native Telegram popup displays "Check-In Success ✅" with attendee details. | [ ] Pass<br>[ ] Fail | |
| **UAT-CHK-02** | `mini-app/src/app/_components/Event/ScanRegistrantQRCode.tsx` | 1. Attendee just checked in via `UAT-CHK-01` | 1. Without closing scanner, immediately scan the identical attendee QR pass a second time. | Scanner rejects entry; phone vibrates with error haptic feedback; popup displays "Check-In Failed ❌" / "Already checked in". | [ ] Pass<br>[ ] Fail | |
| **UAT-CHK-03** | `mini-app/src/lib/totp/passToken.ts` | 1. Take a screenshot of Attendee's dynamic QR pass<br>2. Wait > 45 seconds (exceeding ±1 20s step window tolerance) | 1. Officer scans the static screenshot photo on a third phone screen. | System rejects token; popup displays "Check-In Failed ❌" / "Invalid or expired ticket token"; attendee admission is blocked. | [ ] Pass<br>[ ] Fail | |
| **UAT-CHK-04** | `telegram-bot/src/utils/logs-bot.ts` | 1. Successful check-in executed via `UAT-CHK-01`<br>2. Access to staging forum group | 1. Open staging forum group (`-1002264975789`).<br>2. Inspect Topic 4 (`tickets_topic`). | Check-in audit notification appears in Topic 4 with ticket ID, attendee name, check-in timestamp, and scanning officer handle. | [ ] Pass<br>[ ] Fail | |

---

## 4. Platform Admin Persona (`UAT-ADM`)

Scenarios cover Telegram forum-group topic segregation, in-chat interactive moderation cards, and attendee report routing.

| ID | Ref | Preconditions | Steps | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-ADM-01** | `telegram-bot/src/utils/logs-bot.ts` | 1. Admin member of internal staging forum group (`LOGS_GROUP_ID`) | 1. Trigger actions across the platform:<br>&nbsp;&nbsp;a. Publish event<br>&nbsp;&nbsp;b. Register / check in ticket<br>&nbsp;&nbsp;c. Stars / TON payment<br>&nbsp;&nbsp;d. Trigger worker exception<br>2. Inspect forum topics 2, 4, 276, and 12. | Notifications route strictly to configured topics:<br>• Topic 2: `events_topic`<br>• Topic 4: `tickets_topic`<br>• Topic 276: `payments_topic`<br>• Topic 12: `system_topic`<br>Zero cross-topic leaks. | [ ] Pass<br>[ ] Fail | |
| **UAT-ADM-02** | `mini-app/src/moderationBot/onCallBackModerateEvent.ts` | 1. Staging event submitted requiring review<br>2. Admin viewing moderation card in Telegram supergroup | 1. Inspect event card with inline buttons `[Approve]`, `[Reject]`, `[Send Notice]`.<br>2. On mobile Telegram client, tap `[Approve]`.<br>3. Inspect card and public events channel. | Bot answers callback; card updates to "Approved by @admin"; event marks `hidden: false`; public channel receives event broadcast. | [ ] Pass<br>[ ] Fail | |
| **UAT-ADM-03** | `mini-app/src/lib/tgBot.ts` | 1. Attendee opens event details in TMA<br>2. Admin monitoring moderation forum | 1. Attendee taps Report Event -> selects reason (e.g. "Spam/Scam") -> submits report.<br>2. Admin checks moderation forum topic in Telegram. | Abuse alert appears in moderation topic detailing event UUID, reporting user ID, reason, and quick takedown action buttons. | [ ] Pass<br>[ ] Fail | |

---

## Persona Sign-Off (Gate G6)

All 4 personas must be formally signed off before initiating production deployment.

### 1. Organizer Persona Sign-Off
- **Tester Name:** ___________________________
- **Date:** ___________________________
- **Device Tested:** ___________________________
- **Sign-Off Status:** [ ] APPROVED (4/4 Pass) &nbsp;&nbsp;&nbsp;&nbsp; [ ] REJECTED (Blocker open)
- **Signature:** ___________________________

### 2. Attendee Persona Sign-Off
- **Tester Name:** ___________________________
- **Date:** ___________________________
- **Device Tested:** ___________________________
- **Sign-Off Status:** [ ] APPROVED (8/8 Pass) &nbsp;&nbsp;&nbsp;&nbsp; [ ] REJECTED (Blocker open)
- **Signature:** ___________________________

### 3. Check-in Officer Persona Sign-Off
- **Tester Name:** ___________________________
- **Date:** ___________________________
- **Device Tested:** ___________________________
- **Sign-Off Status:** [ ] APPROVED (4/4 Pass) &nbsp;&nbsp;&nbsp;&nbsp; [ ] REJECTED (Blocker open)
- **Signature:** ___________________________

### 4. Platform Admin Persona Sign-Off
- **Tester Name:** ___________________________
- **Date:** ___________________________
- **Device Tested:** ___________________________
- **Sign-Off Status:** [ ] APPROVED (3/3 Pass) &nbsp;&nbsp;&nbsp;&nbsp; [ ] REJECTED (Blocker open)
- **Signature:** ___________________________

---

## Post-Deploy Production Checks (Gate G7 — Done by Owner Only)

> [!CAUTION]
> **OWNER ONLY:** These checks execute against live production bot [`@theontonbot`](https://t.me/theontonbot) and [`https://app.onton.live`](https://app.onton.live) immediately following production deployment. Only the project owner may execute real-money transactions.

| ID | Ref | Scope | Steps | Expected Result | Pass / Fail | Tx Hash / Order ID |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **PROD-01** | `telegram-bot/src/handlers/starsPaymentHandler.ts` | Real Telegram Stars Payment (1 Star) | 1. Open `@theontonbot` TMA -> select live 1-Star test ticket tier.<br>2. Choose "Telegram Stars" -> tap "Pay with Stars".<br>3. Confirm payment in native Telegram sheet (deducts 1 real Star).<br>4. Check DM thread with `@theontonbot`. | Native sheet confirms payment; order status updates to `completed`; bot sends DM with ticket button; real charge ID recorded in DB. | [ ] Pass<br>[ ] Fail | Order UUID: |
| **PROD-02** | `mini-app/src/cronJobs/tasks/CheckTransactions.ts` | Real TON Mainnet Payment (0.05 TON) | 1. On `app.onton.live`, select 0.05 TON test ticket tier.<br>2. Connect mainnet Tonkeeper.<br>3. Sign 0.05 TON transfer with comment `onton_order=<uuid>`.<br>4. Monitor TonCenter mainnet explorer and order status. | Real 0.05 TON confirms on `tonviewer.com`; payment cron worker matches memo within 14s; order completes and ticket pass issues. | [ ] Pass<br>[ ] Fail | TON Tx Hash: |
| **PROD-03** | `mini-app/src/app/_components/Event/ScanRegistrantQRCode.tsx` | Real Door Scanner & Ticket Validation | 1. On phone A, open check-in scanner on `@theontonbot`.<br>2. On phone B, display QR pass from `PROD-01` or `PROD-02`.<br>3. Scan pass once -> verify admission.<br>4. Scan pass second time -> verify rejection. | First scan displays green success confirmation and marks attendee checked in; second scan triggers red duplicate warning. | [ ] Pass<br>[ ] Fail | Ticket UUID: |

### Gate G7 Final Production Approval
- **Project Owner:** Mahdi Farimani
- **Date Executed:** ___________________________
- **Prod Stars Order UUID:** ___________________________
- **Prod TON Mainnet Tx Hash:** ___________________________
- **Production Status:** [ ] PRODUCTION LIVE & STABLE &nbsp;&nbsp;&nbsp;&nbsp; [ ] ROLLBACK TRIGGERED
