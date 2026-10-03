---
name: "🚀 Release Candidate UAT Run"
about: "Track and sign off on a full manual regression cycle for a release candidate before production deploy"
title: "[RC UAT]: Release Candidate vX.X.X (Staging)"
labels: ["qa", "uat-run", "release-gate"]
assignees: []
---

# 🚀 Release Candidate UAT Run

- **Release Version / Tag:** `vX.X.X-rc.1`
- **Staging Commit / SHA:** `abc1234`
- **Target Bot:** `@notnonstagebot`
- **Staging Web App:** `https://app.dev.onton.live`
- **Lead QA Tester:** @tester-username
- **Release Engineer:** @mahdifarimani

---

## 🛑 Production Release Gate Criteria (Definition of Done)

All three requirements must be met before deploying to `@theontonbot`:
- [ ] **Zero P0 (Blocker) bugs open**
- [ ] **Zero P1 (Critical) bugs open**
- [ ] **100% of the regression checklist below marked as Passed**
- [ ] **Formal QA Sign-off stamped at the bottom of this issue**

---

## 📋 Master Persona Regression Matrix

### 👤 Persona 1: Guest / Unauthenticated Visitor
- [ ] **FLOW-G1:** Homepage event feed browsing, search, and category filtering
- [ ] **FLOW-G2:** Event landing page details view (schedule, speakers, Lu.ma-style layout)
- [ ] **FLOW-G3:** Protected action prompts authentication/connection cleanly without hanging
- [ ] **FLOW-G4:** Dark/Light theme switching preserves high contrast and legible typography
- [ ] **FLOW-G5:** External deep links (`/event?startapp=...`) load targeted event directly

### 🎟️ Persona 2: Registered Attendee
- [ ] **FLOW-A1:** Native TMA auto-authentication and profile initialization
- [ ] **FLOW-A2:** Free RSVP registration with custom questionnaire completion
- [ ] **FLOW-A3:** Paid ticket checkout via Telegram Stars (invoice, pre-checkout, success modal)
- [ ] **FLOW-A4:** Paid ticket checkout via TON / Jetton (Tonkeeper testnet deep link & confirmation)
- [ ] **FLOW-A5:** Ticket pass view (QR code display, pass details, add-to-calendar)
- [ ] **FLOW-A6:** Approval-gated event registration (pending state, approval notice, ticket unlock)
- [ ] **FLOW-A7:** Online Livestream gated access link reveals upon ticket confirmation
- [ ] **FLOW-A8:** My Tickets / Activity tab displays all active and past registrations

### 🎪 Persona 3: Event Organizer
- [ ] **FLOW-O1:** Event creation wizard (dates, location, capacity, cover image upload)
- [ ] **FLOW-O2:** Multi-tier ticket setup (Free, VIP, Early Bird, Stars pricing)
- [ ] **FLOW-O3:** Custom registration questionnaire builder (text, dropdown, checkboxes)
- [ ] **FLOW-O4:** Event publishing & Telegram channel broadcast integration
- [ ] **FLOW-O5:** Organizer dashboard: Real-time attendee list and ticket sales counts
- [ ] **FLOW-O6:** Attendee approval/rejection moderation actions
- [ ] **FLOW-O7:** CSV Attendee export downloads cleanly with correct UTF-8 encoding
- [ ] **FLOW-O8:** Event detail updates (time, venue, description) reflect immediately

### 📱 Persona 4: Check-in Officer
- [ ] **FLOW-C1:** Access check-in officer scanner interface via authorization link
- [ ] **FLOW-C2:** Scan valid Attendee QR code -> Successful check-in validation & feedback
- [ ] **FLOW-C3:** Duplicate scan test -> Immediate alert "Already Checked In" with timestamp
- [ ] **FLOW-C4:** Invalid / Wrong event QR code test -> Immediate clear rejection notice

### 🛡️ Persona 5: Platform Admin (Client Web Panel)
- [ ] **FLOW-AD1:** Admin authentication and role verification
- [ ] **FLOW-AD2:** Global event moderation (approve, feature, or suspend events)
- [ ] **FLOW-AD3:** Platform metrics and revenue/transaction ledger accuracy
- [ ] **FLOW-AD4:** Worker and background queue health monitoring

### 🔗 Persona 6: Partner & Affiliate
- [ ] **FLOW-P1:** Affiliate referral link generation (`join-[hash]`)
- [ ] **FLOW-P2:** Attribution tracking (clicks, registrations, attributed tickets)
- [ ] **FLOW-P3:** Referral commission / points calculation accuracy

### 🏅 Persona 7: Web3 & SBT Credentials (If enabled)
- [ ] **FLOW-W1:** TonConnect wallet connection and address binding
- [ ] **FLOW-W2:** Proof of Attendance (PoA) SBT issuance after validated check-in
- [ ] **FLOW-W3:** Badge gallery and external Tonviewer verification link

---

## 📱 Mobile OS & Viewport Verification Matrix

| Device / Platform | Tested By | Date | Status (Pass / Fail / N/A) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **iOS (iPhone) Native Telegram** | | | | |
| **Android Native Telegram** | | | | |
| **Telegram Desktop (macOS/Win)** | | | | |
| **Web Browser (Chrome/Safari)** | | | | |

---

## 🐛 Linked Release Blocker / Bug Issues

| Issue # | Severity | Title | Status | Assignee |
| :--- | :--- | :--- | :--- | :--- |
| *(None)* | | | | |

---

## ✍️ Final QA Sign-Off

> **Sign-off Rule:** Only check this box when all gates above are green and no P0/P1 issues remain unresolved.

- [ ] **QA LEAD APPROVAL:** I have verified this release candidate on Staging (`@notnonstagebot`) across all required personas and platforms. I certify that the candidate meets the ONTON production quality standards.
  - **Signed by:** 
  - **Date & Time:** 
  - **Release Verdict:** `GO FOR PRODUCTION` / `NO-GO`
