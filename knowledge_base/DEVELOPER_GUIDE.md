# ONTON Platform Developer Guide

Welcome to the ONTON engineering team! This guide will help you set up your environment, understand the codebase structure, and contribute effectively.

## 1. Quick Start (Onboarding)

### Prerequisites
*   **Node.js**: v20+ (managed via nvm recommended)
*   **Package Manager**: `yarn` (v1.22.x)
*   **Docker**: Required for local database and services.

### Setup Steps
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/YourOrg/ontonbot.git
    cd ontonbot
    ```

2.  **Install Dependencies**:
    ```bash
    # Install root dependencies (if any)
    yarn install
    
    # Install Mini App dependencies
    cd mini-app
    yarn install
    ```

3.  **Environment Variables**:
    *   Copy `.env.example` to `.env` in `mini-app/`.
    *   *Ask the lead developer for the required secrets (e.g., specific Bot Token, TON Wallet Seed).*

4.  **Start Local Infrastructure**:
    *   Spin up PostgreSQL, Redis, and MinIO:
    ```bash
    # From root directory
    docker-compose -f docker-compose.yml up -d
    ```

5.  **Run Database Migrations**:
    ```bash
    cd mini-app
    yarn run db:up
    ```

6.  **Start Development Server**:
    ```bash
    # In mini-app directory
    yarn run dev
    ```
    *   The app should be running at `http://localhost:3000`.

---

## 2. Architecture Overview

ONTON is built on a **T3 Stack-inspired architecture** (Next.js + tRPC + Drizzle).

### High-Level Diagram
```mermaid
graph TD
    User((User)) -->|Browser/Telegram| MiniApp[Mini App (Next.js)]
    User -->|Chat| Bot[Telegram Bot (Grammy)]
    
    subgraph "Backend Services"
        MiniApp -->|tRPC via HTTP| API[API Server]
        API -->|Query| DB[(PostgreSQL)]
        API -->|Cache| Redis[(Redis)]
        API -->|Task Queue| RMQ[RabbitMQ]
    end
    
    subgraph "Background Workers"
        RMQ -->|Consume| Workers[Worker Service]
        Workers -->|Mint/Verify| TON[TON Blockchain]
        Cron[Cron Scheduler] -->|Trigger| API
    end
```

---

## 3. Where Logic Lives

Understanding *where* to put your code is key to maintaining a clean codebase.

### A. Frontend UI (`src/app/`)
*   **Pages:** `src/app/(navigation)/...`
*   **Components:** `src/components/` (Reusable UI elements).
*   **State:** `src/zustand/` (Global client state stores).
*   **Rule:** Keep logic here strictly to *presentation* and *interaction*. Avoid complex business rules.

### B. Business Logic (`src/server/routers/`)
*   **tRPC Routers:** This is where the core logic resides.
    *   `src/server/routers/events.ts`: Event creation, updating, validation.
    *   `src/server/routers/orders.ts`: Ticket purchase flows.
    *   `src/server/routers/users.ts`: User profile management.
*   **Rule:** Validate input using Zod schemas here. Call helpers/services for complex operations.

### C. Data Access (`src/db/`)
*   **Schema:** `src/db/schema/` (Drizzle definitions).
*   **Access Modules:** `src/db/modules/` (Helper functions for common DB queries).
*   **Rule:** Do not write raw SQL in routers if a helper exists.

### D. Background Jobs (`src/workers/` & `src/cronJobs/`)
*   Use this for long-running tasks:
    *   Minting NFTs.
    *   Sending mass notifications.
    *   Checking blockchain transaction status.

---

## 4. Contributing Checklist

Before opening a Pull Request (PR):
1.  **Run Tests:** `yarn test` (or specific test suites relevant to your changes).
2.  **Lint Code:** `yarn lint`.
3.  **Format Code:** `yarn format` (Prettier).
4.  **Check Types:** `yarn type:check` (TypeScript validation).

*Happy Coding!*
