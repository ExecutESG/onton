# ONTON Mini App Service Overview

The `mini-app` is the core of the ONTON platform. It is a **Next.js** application that serves both the User Interface (the Mini App inside Telegram) and the Organizer Dashboard (Web). It also acts as the primary API server using **tRPC**.

## 1. Technology Stack

*   **Framework:** Next.js 14 (App Router & Pages Router hybrid)
*   **Language:** TypeScript
*   **API:** tRPC (End-to-end typesafe API)
*   **Database:** PostgreSQL (via Drizzle ORM)
*   **State Management:** Zustand + Tanstack Query
*   **Styling:** TailwindCSS + Shadcn/UI (Radix) + Material UI
*   **Real-time:** Socket.io (via separate entry point)

## 2. Architecture & Components

The `mini-app` codebase is monolithic but deploys into multiple specialized services (containers) based on the entry point command.

| Service Name | Entry Point | Purpose |
| :--- | :--- | :--- |
| **`mini-app`** | `next start` | Main Web Server. Handles UI and tRPC API requests. |
| **`mini-app-notification-socket`** | `src/sockets/index.ts` | WebSocket Server. Handles real-time updates (notifications, status changes). |
| **Workers** | `src/workers/*.ts` | Background processes for heavy lifting (see below). |

### Background Workers
These run as separate Docker services to keep the main web server responsive:

*   **`mini-app-sbt-worker`**: Handles Soulbound Token (SBT) minting on TON.
*   **`mini-app-reward-worker`**: Processes reward distributions to users.
*   **`mini-app-poa-worker`**: Validates "Proof of Action" (PoA) submissions.
*   **`mini-app-nft-api-worker`**: Syncs NFT data from external APIs.
*   **`mini-app-ordinary-worker`**: Routine maintenance tasks.

## 3. Key Directory Structure

```text
mini-app/
├── src/
│   ├── app/                # Next.js App Router (Pages & Layouts)
│   ├── components/         # Reusable React Components
│   ├── db/                 # Database Schema & Drizzle Config
│   ├── server/             # Backend Logic
│   │   ├── routers/        # tRPC Routers (API Endpoints)
│   │   ├── trpc.ts         # tRPC Configuration
│   │   └── context.ts      # Auth & Context Creation
│   ├── services/           # Business Logic Services (Wallet, Telegram, etc.)
│   ├── sockets/            # Socket.io Server Code
│   ├── workers/            # Worker Scripts (Entry points for Cron Jobs)
│   │   ├── cronJobSchedulerPayment.ts
│   │   ├── poaWorker.ts
│   │   └── ...
│   └── cronJobs/           # Logic for the cron jobs
└── package.json            # Scripts & Dependencies
```

## 4. API & Data Flow

### tRPC (Client-Server Communication)
The frontend communicates with the backend via tRPC.
*   **Routers:** Located in `src/server/routers`.
*   **Definition:** `src/server/index.ts` combines all routers into `appRouter`.
*   **Usage:**
    *   **Backend:** Define a procedure: `publicProcedure.query(...)`
    *   **Frontend:** Call it hook-style: `trpc.user.getProfile.useQuery()`

### Database Access
*   **ORM:** Drizzle ORM is used for all DB interactions.
*   **Schema:** Defined in `src/db/schema`.
*   **Migrations:** Managed via `drizzle-kit`.

## 5. Development & Commands

| Command | Description |
| :--- | :--- |
| `yarn dev` | Starts the Next.js dev server. |
| `yarn db:gen` | Generates SQL migrations from schema changes. |
| `yarn db:up` | Applies migrations to the database. |
| `yarn start:socket` | Starts the Socket.io server locally. |
| `yarn start:poa` | Starts the POA worker locally. |

## 6. Payment System

The Mini App handles payments (Ticket Sales, Organizer Upgrades) using a **Verify-then-Process** mechanism on the TON blockchain.

*   **Flow:** User creates an order (API) -> User sends TON with a specific comment -> Background worker verifies transaction -> Order marked as paid -> NFT Minted.
*   **Key Workers:** `CheckTransactions` (Verification), `MintNFTForPaidOrders` (Fulfillment).
*   **Detailed Guide:** See [Payment System Overview](payment_system_overview.md) or the [Visual Guide](payment_system_overview.html).

## 7. Integration Points

*   **Telegram Bot:** The Mini App relies on the `telegram-bot` service for sending messages to users. It calls the Bot's internal API (e.g., `http://telegram-bot:3333/send-message`).
*   **MinIO:** Used for object storage (images, videos).
*   **RabbitMQ:** Used for message queuing (handling high-volume events).
*   **Redis:** Used for caching and socket adapters.
