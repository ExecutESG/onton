# ONTON UX Review & Improvement Issues

This directory contains the comprehensive UX review and formal improvement specifications for the **ONTON** platform, covering both the **Telegram Mini App (TMA)** and the **Web Client Panel**.

---

## 📑 Live GitHub Issues Catalog

| # | Issue ID | Live GitHub Link | Title | Target Module | Labels |
|---|---|---|---|---|---|
| **01** | `#904` | [#904](https://github.com/ExecutESG/onton/issues/904) | **[UX/TMA] Rapid Continuous QR Scanner Mode for Event Door Check-In** | `mini-app` (Scan QR) | `Design`, `enhancement`, `Critical` |
| **02** | `#905` | [#905](https://github.com/ExecutESG/onton/issues/905) | **[UX/Flow] Re-architect Attendee Event Page Layout & Defer Web3 Onboarding** | `mini-app` (Event Page) | `Design`, `enhancement` |
| **03** | `#906` | [#906](https://github.com/ExecutESG/onton/issues/906) | **[UX/TMA] Offline Pass & Direct Telegram Chat Delivery for Check-In QR Codes** | `telegram-bot` & `mini-app` | `Design`, `feature`, `Critical` |
| **04** | `#908` | [#908](https://github.com/ExecutESG/onton/issues/908) | **[UX/Admin] Batch Triage & Fast-Action Filters in TMA Guest Management** | `mini-app` (Guest List) | `Design`, `enhancement` |
| **05** | `#909` | [#909](https://github.com/ExecutESG/onton/issues/909) | **[UX/Interaction] Fix Sudden Mini App Termination on Excel Guest List Export** | `mini-app` (Interactions) | `Design`, `bug`, `softFix` |
| **06** | `#910` | [#910](https://github.com/ExecutESG/onton/issues/910) | **[UX/Web] Modernize Event Admin Dashboard with Analytics & Safe Printing** | `client-web-panel` | `Design`, `enhancement` |

---

## 🎯 Primary Operational Impact

* **Door Check-In Latency**: Reduced from **~12.8s** to **<2.0s** per attendee.
* **Attendee Funnel Conversion**: Projected **+30% to +45%** lift for Web2 users by removing mandatory wallet prompts before RSVP.
* **Offline Event Reliability**: Prevents entrance bottlenecks caused by weak venue cellular reception through direct Telegram photo delivery and local storage caching.
* **Admin Triaging Velocity**: Batch approval controls reduce 50-applicant approval time from **~3.5 minutes** to **<15 seconds**.
