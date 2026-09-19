# ONTON Issue Categorization Taxonomy & Backlog Classification

This document defines the issue taxonomy for the `ExecutESG/onton` repository and classifies all **85 currently open issues** into structured categories.

---

## 1. Issue Category Definitions

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          ONTON ISSUE TAXONOMY                                │
├──────────────────────────┬────────────────────────────────────────────────────┤
│ 1. 💰 Revenue Model      │ Direct monetization, pricing tiers, payment rails, │
│                          │ marketplace commission, and syndicate packaging.   │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 2. 🚀 Growth & Viral     │ User acquisition loops, affiliate share-to-earn,   │
│                          │ SEO, OpenGraph metadata, and partner syndication.  │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 3. 🐛 Bug Fixes          │ Broken functionality, state reset, race condition, │
│                          │ overbooking, crash prevention, and error handling. │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 4. 🎨 UX & Improvement   │ User interface polish, checkout flow, scanner mode,│
│                          │ attendee experience, and admin dashboard design.   │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 5. 🛡️ Security & Integrity│ Vault protection, auth, API keys, secret removal,   │
│                          │ rate limiting, CORS, and BigInt payment precision. │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 6. 🏗️ Architecture       │ Refactoring, monolith decoupling, ORM unification, │
│                          │ tRPC service layer, and event-driven queues.       │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 7. ⚙️ DevOps & Infra     │ CI/CD pipelines, Docker networks, E2E testing,     │
│                          │ load testing, chaos testing, and runbooks.         │
├──────────────────────────┼────────────────────────────────────────────────────┤
│ 8. 🌐 Web3 & Governance  │ On-chain smart contracts, verifiable randomness,   │
│                          │ Snapshot DAO voting, and SBT tokenomics.           │
└──────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Category Breakdown of Open Issues (85 Total)

### 💰 1. Revenue Model (6 Issues)
*Features and infrastructure directly generating or collecting platform revenue.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#971** | feat(syndicate): Launch ONTON Web3 Partnership & Promotion Marketplace (Campaign Syndication & Cohorts) | `sprint:3-4` | High |
| **#970** | Implement native Telegram Stars checkout | `sprint:3-4` | High |
| **#966** | Redesign multi-tier ticketing schema (1-to-many event_payment_info) | `sprint:3-4` | High |
| **#922** | [UX/UI] Prominent Draft/Hidden Status Banner and Inline Order Payment on Event Dashboard | `sprint:3-4` | Critical |
| **#918** | [UX/UI] Decouple Attendee Profile from Paid Organizer Upsells in "My ONTON" | `sprint:3-4` | Medium |
| **#915** | [UX/UI] Self-Serve Organizer Onboarding with Free Trial Sandbox & Transparent Pricing | `sprint:3-4` | Critical |

---

### 🚀 2. Growth & Distribution (3 Issues)
*Features designed to acquire new users, increase organic sharing, and boost SEO visibility.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#949** | Build Affiliate "Share-to-Earn" UI component | `sprint:9-10` | Medium |
| **#948** | SSR event pages with OpenGraph meta tags for SEO | `sprint:9-10` | High |
| **#869** | [Marketing Website] Phase 3: ONION Integration & Advanced Features | — | Medium |

---

### 🐛 3. Bug Fixes (11 Issues)
*Resolving crashes, edge cases, state corruption, and logic defects.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#968** | Fix bot deep-link routing (parsed path is discarded) | `sprint:1-2` | Critical |
| **#967** | Add row-level locking to RSVP to prevent overbooking | `sprint:1-2` | Critical |
| **#962** | Fix Newton participant-tma root page and middleware routing | `sprint:11-12` | Medium |
| **#950** | Fix 429 FloodWait retry logic in Telegram broadcast | `sprint:1-2` | High |
| **#947** | Add row-level locking to NFT minting to prevent index collision | `sprint:1-2` | Critical |
| **#942** | Add dead-letter queue for failed minting orders | `sprint:1-2` | High |
| **#933** | Fix tournament rewards date bug and hardcoded flags | `sprint:1-2` | Medium |
| **#924** | [Bug/UX] Eliminate Abrupt App Closure on Attendee List Excel Export | `sprint:1-2` | High |
| **#921** | [UX/UI] Make SBT Video Upload Optional & Fix Online Event Secret Phrase State Reset | `sprint:1-2` | Medium |
| **#917** | [Bug/UX] Decouple Navigation from Step 3 Validation in Event Creation Wizard | `sprint:1-2` | Critical |
| **#911** | [Bug/UX] Fix Telegram MainButton Conflict with Inline Event Registration Form | `sprint:1-2` | Critical |

---

### 🎨 4. UX & Product Improvement (11 Issues)
*Enhancing the usability, accessibility, and visual clarity of attendee and organizer workflows.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#969** | Add "Duplicate Event" one-click button for organizers | `sprint:3-4` | Medium |
| **#951** | Build Organizer Analytics Dashboard (sales, show-rates) | `sprint:9-10` | Medium |
| **#925** | [UX/UI] Fix Misleading Hosted Events Empty State & Remove 2000ms Artificial Delay | `sprint:3-4` | Medium |
| **#923** | [UX/UI] Continuous Rapid-Scan Mode for Event Door Check-in | `sprint:3-4` | High |
| **#919** | [UX/UI] Auto-Detect Connected Wallet for Ticket Recipient & Simplify Web3 Terminology | `sprint:3-4` | Medium |
| **#916** | [UX/Bot] Implement Public Participant /help and Conversational Fallback | `sprint:3-4` | Medium |
| **#913** | [UX/Messaging] Send Instant Telegram Bot DM Receipt on Event Registration | `sprint:3-4` | High |
| **#912** | [UX/UI] Relax Mandatory Registration Fields & Auto-Populate from Telegram Context | `sprint:3-4` | Medium |
| **#910** | [UX/Web] Modernize Event Admin Dashboard with Analytics & Safe Printing | `sprint:3-4` | High |
| **#908** | [UX/Admin] Batch Triage & Fast-Action Filters in TMA Guest Management | `sprint:3-4` | Medium |
| **#907** | [UX/UI] Re-order Event Page Hierarchy: Elevate Registration CTA & Defer Web3 Modules | `sprint:3-4` | Critical |

---

### 🛡️ 5. Security & Financial Integrity (18 Issues)
*Protecting funds, securing private keys, sealing authentication bypasses, and hardening APIs.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#985** | 🟢 M3: Add API gateway and edge-level rate limiting / WAF | `sprint:1-2` | Medium |
| **#984** | 🟢 M2: Deduplicate Telegram authentication logic into shared package | `sprint:1-2` | Medium |
| **#976** | 🔴 C4: Remove secrets from repository — SSH keys and .env committed | `sprint:1-2` | Critical |
| **#975** | 🔴 C3: Fix cross-database consistency gap (mini-app ↔ nft-manager) | `sprint:1-2` | Critical |
| **#965** | Restore Client Web Panel authentication | `sprint:3-4` | Critical |
| **#963** | Remove NODE_TLS_REJECT_UNAUTHORIZED=0 and clean .env.example | `sprint:1-2` | Medium |
| **#958** | Add authentication to event metadata export endpoint | `sprint:1-2` | High |
| **#955** | Hash API keys and use constant-time comparison | `sprint:1-2` | High |
| **#952** | Remove private SSH keys from repository root | `sprint:1-2` | Critical |
| **#946** | Implement Hybrid Auth (Google/Email + Telegram linking) | `sprint:9-10` | High |
| **#945** | Replace floating-point with BigInt for TON payment reconciliation | `sprint:1-2` | Critical |
| **#943** | Replace wildcard CORS with domain allowlist | `sprint:1-2` | High |
| **#940** | Add HMAC authentication to bot Express API | `sprint:1-2` | High |
| **#936** | Fix TonProof nonce enforcement — Redis challenge bypass | `sprint:1-2` | Critical |
| **#935** | Add initData auth_date expiration check (24h TTL) | `sprint:1-2` | High |
| **#932** | Add real social verification to quest completion (replace 30s timer bypass) | `sprint:5-6` | High |
| **#927** | [Security/Reliability] Enforce Environment Token Isolation & Startup Sanity Check | `sprint:1-2` | High |
| **#914** | [Bug/UX] Prevent Mini App Shutdown on Social Quest OAuth on Mobile | `sprint:1-2` | Critical |

---

### 🏗️ 6. Architecture & Code Refactoring (13 Issues)
*Eliminating technical debt, untangling god monoliths, and decoupling database layers.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#983** | 🟢 M1: Unify package managers — consolidate yarn and pnpm | `sprint:7-8` | Medium |
| **#982** | 🟡 S6: Reduce client-side JS bundle — remove Webpack browser polyfills | `sprint:7-8` | Medium |
| **#979** | 🟡 S3: Replace cron-based polling with event-driven RabbitMQ architecture | `sprint:7-8` | Medium |
| **#978** | 🟡 S2: Refactor monolithic tRPC routers into service layer | `sprint:7-8` | Medium |
| **#977** | 🟡 S1: Resolve framework & version inconsistency across modules | `sprint:7-8` | Medium |
| **#974** | 🔴 C2: Unify data access layer — Triple ORM Fragmentation | `sprint:7-8` | Critical |
| **#973** | 🔴 C1: Extract backend from mini-app — God Monolith Pattern | `sprint:7-8` | Critical |
| **#972** | 🏗️ Architecture Blueprint — Master Tracking Issue | `sprint:7-8` | High |
| **#944** | Clean up disabled campaign cron jobs (remove or re-enable) | `sprint:7-8` | Low |
| **#941** | Migrate payment polling to RabbitMQ event-driven architecture | `sprint:7-8` | High |
| **#939** | Decompose campaignRouter.ts (24KB) similarly | `sprint:7-8` | Medium |
| **#938** | Decompose events.ts (42KB) into EventService + EventController | `sprint:7-8` | Medium |
| **#937** | Centralize RBAC into AccessControlService | `sprint:7-8` | High |

---

### ⚙️ 7. Infrastructure, DevOps & Testing (21 Issues)
*Automating CI/CD pipelines, containerization, load resilience, and test suites.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#986** | 🟢 M4: Remove hardcoded IP addresses from Docker network config | `sprint:11-12` | Medium |
| **#981** | 🟡 S5: Eliminate single points of failure in production infrastructure | `sprint:11-12` | Medium |
| **#980** | 🟡 S4: Add automated unit and integration tests to CI pipeline | `sprint:5-6` | Medium |
| **#964** | Commit and deploy QA test suite (90 E2E tests + quality portal) | `sprint:1-2` | High |
| **#961** | Make CI validate-services fail on actual errors | `sprint:1-2` | High |
| **#960** | Create incident response runbook | `sprint:11-12` | Medium |
| **#959** | Separate dev/main deployment targets | `sprint:11-12` | High |
| **#954** | Chaos testing — simulate infrastructure failures | `sprint:11-12` | Medium |
| **#953** | Load test: 5,000 concurrent RSVPs | `sprint:11-12` | Medium |
| **#934** | Add GitHub Actions CI job for TypeScript check + Playwright E2E | `sprint:5-6` | High |
| **#931** | Build Vitest integration test suite for payment lifecycle | `sprint:5-6` | High |
| **#930** | [Performance/Reliability] Add Scope Bounds and Circuit Breaker to CheckAllUsersBlock Cron Task | `sprint:1-2` | High |
| **#929** | [Architecture/Reliability] Transition Production Telegram Bot from Long-Polling to Webhook | `sprint:1-2` | High |
| **#928** | [Monitoring/Alerting] Implement External Dead-Man's Snitch Heartbeat & Synthetic Polling Canary for Telegram Bot | `sprint:1-2` | High |
| **#926** | [Reliability/DevOps] Add Native Docker Healthcheck & Auto-Recovery for Telegram Bot Container | `sprint:1-2` | High |
| **#920** | [UX/Bug] Filter "My Participated -> Contests" by User History Instead of Global Ended Games | `sprint:1-2` | Medium |
| **#866** | Configure Subdomain Access for Client Web Panel | — | High |
| *Sub-issues* | #904, #905, #906, #909 (Tracked under rapid scan, offline pass, and export stabilization) | — | — |

---

### 🌐 8. Web3 & Governance (2 Issues)
*Decentralized governance, on-chain mechanics, and smart contract features.*

| Issue | Title | Sprint | Priority |
| :---: | :--- | :---: | :---: |
| **#957** | Snapshot.org governance integration research | `sprint:11-12` | Medium |
| **#956** | Implement verifiable randomness for raffle draws | `sprint:11-12` | Medium |
