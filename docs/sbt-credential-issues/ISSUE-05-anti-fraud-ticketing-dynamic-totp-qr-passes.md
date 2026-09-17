# 🎟️ Anti-Fraud Check-In: Dynamic Rotating TOTP QR Passes & Instant SBT Issuance

## 📌 Overview & Objective
Static QR codes on event tickets are vulnerable to screenshots, screen recordings, unauthorized transfers, and gate fraud. 

We must introduce **Dynamic Rotating TOTP QR Passes** in the Participant TMA that refresh every 15 seconds, coupled with a fast staff scanner mode that triggers instant SBT attendance badge minting upon check-in.

---

## 🔍 Existing Codebase References
* `newton/apps/participant-tma/app/ticket/[id]/page.tsx`: Current ticket presentation page.
* `newton/apps/participant-tma/components/ticket/qrcode/`: QR code display components.
* `mini-app/src/services/rewardsService.ts`: `CsbtTicket` and native SBT minting hooks.
* `mini-app/src/db/schema/visitors.ts`: Visitor status and check-in tracking.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. Dynamic Rotating QR Code Component
* Generate a time-based rotating QR token every 15 seconds on the client:
  $$	ext{Token} = 	ext{HMAC-SHA256}(	ext{TicketSecret}, \lfloor 	ext{Timestamp} / 15 floor)$$
* Visual animated countdown bar (progress ring or 15s timer) showing pass freshness.
* Watermarked moving background / security wave to defeat static screen recordings.

### 2. Staff Gate Scanner TMA Mode (`/scan`)
* High-speed continuous camera scanner in TMA with audio beep and haptic feedback.
* Validates rotating token against server secret:
  * If valid: immediately marks visitor as `status = "checkedin"`, displays green checkmark and attendee name.
  * If expired or previously used: displays red warning with exact check-in timestamp.

### 3. Instant Post-Check-In SBT Mint Hook
* When check-in is confirmed:
  * Asynchronously dispatches `sbtService.mintSbtBadge` to the visitor's connected TON wallet.
  * Sends automated Telegram notification via `@theontonbot`: *"Welcome to the event! Your official Soulbound Attendance Badge has been minted."*

---

## ✅ Acceptance Criteria
* [ ] Screenshot of ticket QR code fails validation if scanned >15 seconds later.
* [ ] Staff scanner verifies valid dynamic QR codes in <300ms.
* [ ] Valid check-in automatically updates database status and queues SBT minting transaction.

