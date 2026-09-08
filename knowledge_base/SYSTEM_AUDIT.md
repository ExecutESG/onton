# System Audit & Architecture Mapping

**Date:** 2026-02-12
**Scope:** Root Directory Scan (`ontonbot/`)

## 1. Executive Summary
ONTON is a hybrid platform primarily built on **Next.js** (Mini App) and **Grammy** (Telegram Bot). It leverages the **TON Blockchain** for asset management (NFTs, SBTs) and payments. The architecture is split between a user-facing Mini App for interaction/management and a Telegram Bot for notifications/quick actions, supported by a robust backend using **tRPC** and **Drizzle ORM**.

---

## 2. Core Business Modules

### A. Mini App (`ontonbot/mini-app`)
The core hub for users and organizers.
*   **Entry Points:**
    *   **Frontend:** `src/app` (Next.js App Router).
    *   **API:** `src/server/routers/_app.ts` (tRPC Root).
    *   **Workers:** `src/workers/` & `src/cronJobs/` (Background processing).

*   **Key Logic Layers (`src/server/routers/`):**
    *   **Event Management:** `events.ts`, `organizers.ts`, `hubs.ts` - Validating, creating, and listing events.
    *   **Commerce & access:** `orders.ts`, `tickets.ts`, `registrant.ts` - Purchasing flow, NFT minting triggers, and check-in logic.
    *   **User Identity:** `users.ts`, `userRolesRouter.ts`, `tonProofRouter.ts` - Telegram Auth & Wallet linking.
    *   **Engagement:** `campaignRouter.ts`, `raffleRouter.ts`, `questRouter.ts` - Gamification layers.
    *   **Affiliates:** `affiliateRouter.ts` - Referral tracking.

### B. Telegram Bot (`ontonbot/telegram-bot`)
Primary interface for notifications and lightweight interactions.
*   **Entry Point:** `src/main.ts`.
*   **Framework:** `grammy`.
*   **Modules:**
    *   **Composers (`src/composers/`):** Modular message handling (e.g., `start.composer.ts`, `admin.composer.ts`).
    *   **Handlers (`src/handlers/`):** Specific business logic execution.

### C. DevOps & Infrastructure (`ontonbot/devops`)
*   **Containerization:** `docker-compose` setup for Server, Shadow, and Dev environments.
*   **Reverse Proxy:** Caddy (`Caddyfile`) for SSL and routing.

---

## 3. Tech Stack & Dependencies

### Frontend / Fullstack (Mini App)
*   **Framework:** Next.js 14 (App Router).
*   **Language:** TypeScript.
*   **Styling:** TailwindCSS, Radix UI, Framer Motion.
*   **State Management:** Zustand, React Query (@tanstack/react-query).
*   **API Client:** tRPC Client.
*   **TON Integration:** @tonconnect/ui-react.

### Backend (Mini App Server)
*   **Runtime:** Node.js (v20+ implied).
*   **API Framework:** tRPC (Type-safe RPC).
*   **Database ORM:** Drizzle ORM (PostgreSQL).
*   **Authentication:** Custom Middleware (`src/server/trpc.ts`) validating Telegram `initData`.
*   **Queue/Async:** RabbitMQ (`amqplib`), Redis (`redis`).
*   **Storage:** MinIO (S3-compatible) for metadata/images.
*   **Blockchain:** @ton/core, @ton/ton.

### Database
*   **Primary:** PostgreSQL.
*   **Caching:** Redis.

---

## 4. Technical Debt & Observations

### A. Monolithic Routers
*   **Observation:** Files like `events.ts` (42KB) and `campaignRouter.ts` (24KB) in `src/server/routers` are quite large.
*   **Risk:** Hard to maintain/test. Logic is potentially mixed (Validation + DB + Business Logic).
*   **Recommendation:** Refactor heavy business logic into dedicated `src/services/` (e.g., `EventService.ts`) and keep routers as thin controllers.

### B. Heavy Reliance on Cron Jobs
*   **Observation:** `package.json` lists many cron scripts (`cronJobSchedulerPayment`, `cronJobSchedulerReward`, etc.).
*   **Risk:** Polling databases for changes (e.g., "scan for pending orders") can be inefficient compared to event-driven queues.
*   **Recommendation:** Ensure `amqplib` is fully utilized for event-driven tasks (e.g., "Order Paid" event -> triggers "Mint Worker" immediately) to reduce polling latency.

### C. Auth Logic Dispersal
*   **Observation:** Auth checks are heavily embedded in `src/server/trpc.ts` middlewares (`initDataProtectedProcedure`, `adminOrganizerProtectedProcedure`).
*   **Risk:** As roles grow complexity (e.g., "Co-Organizer"), this file becomes a bottleneck.
*   **Recommendation:** Centralize Role-Based Access Control (RBAC) definitions in a dedicated policy module.

### D. Hardcoded Configurations
*   **Observation:** Some scripts and docker files seem to rely on specific environment setups/files (`.env.shadow`, `github_vars_backup_repo.txt`).
*   **Risk:** fragile deployment if secrets aren't managed via a proper vault or standardized env injection.

---

## 5. Data Flow Map (Simplified)

```mermaid
graph TD
    User[User (Telegram/Web)] -->|HTTPS| Caddy[Caddy Reverse Proxy]
    Caddy -->|/api| NextJS[Next.js Server (Mini App)]
    Caddy -->|Webhooks| Bot[Telegram Bot]
    
    subgraph Mini App Logic
        NextJS -->|RPC| tRPC[tRPC Routers]
        tRPC -->|ORM| DB[(PostgreSQL)]
        tRPC -->|Cache| Redis[(Redis)]
        tRPC -->|Storage| MinIO[MinIO Object Storage]
    end
    
    subgraph Async Workers
        Cron[Cron Scheduler] -->|Polls| DB
        Worker[Workers] -->|Consumes| RabbitMQ[RabbitMQ]
        Worker -->|Mints| TON[TON Blockchain]
    end
```
