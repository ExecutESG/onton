# ONTON UX Review & Improvement Issues

This directory contains the comprehensive UX review and formal improvement specifications for the **ONTON** platform, covering both the **Telegram Mini App (TMA)** and the **Web Client Panel**.

---

## 📑 Issue Catalog

| # | Issue Key | Title | Target Module | Severity / Priority |
|---|---|---|---|---|
| **01** | [`ISSUE-01`](./ISSUE-01-rapid-continuous-qr-scanner.md) | **[UX/TMA] Rapid Continuous QR Scanner Mode for Event Door Check-In** | `mini-app` (Scan QR) | `Critical` / High |
| **02** | [`ISSUE-02`](./ISSUE-02-attendee-event-page-hierarchy.md) | **[UX/Flow] Re-architect Attendee Event Page Layout & Defer Web3 Onboarding** | `mini-app` (Event Page) | `High` / Conversion |
| **03** | [`ISSUE-03`](./ISSUE-03-offline-pass-direct-chat-qr.md) | **[UX/TMA] Offline Pass & Direct Telegram Chat Delivery for Check-In QR Codes** | `telegram-bot` & `mini-app` | `Critical` / Reliability |
| **04** | [`ISSUE-04`](./ISSUE-04-admin-batch-guest-triage.md) | **[UX/Admin] Batch Triage & Fast-Action Filters in TMA Guest Management** | `mini-app` (Guest List) | `Medium` / Efficiency |
| **05** | [`ISSUE-05`](./ISSUE-05-fix-export-app-termination.md) | **[UX/Interaction] Fix Sudden Mini App Termination on Excel Guest List Export** | `mini-app` (Interactions) | `Medium` / Bug / SoftFix |
| **06** | [`ISSUE-06`](./ISSUE-06-modernize-web-admin-panel.md) | **[UX/Web] Modernize Event Admin Dashboard with Analytics & Safe Printing** | `client-web-panel` | `Medium` / Admin Portal |

---

## 🎯 Primary Operational Impact

* **Door Check-In Latency**: Reduced from **~12.8s** to **<2.0s** per attendee.
* **Attendee Funnel Conversion**: Projected **+30% to +45%** lift for Web2 users by removing mandatory wallet prompts before RSVP.
* **Offline Event Reliability**: Prevents entrance bottlenecks caused by weak venue cellular reception through direct Telegram photo delivery and local storage caching.
* **Admin Triaging Velocity**: Batch approval controls reduce 50-applicant approval time from **~3.5 minutes** to **<15 seconds**.
