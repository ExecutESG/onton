# Mini-App Core Service

The **Mini-App** (`ontonbot/mini-app`) is the central brain of the Onton platform. It is a **Node.js** application (likely Next.js API routes or a custom server) acting as the primary backend.

## 1. Role & Responsibilities
- **API Gateway**: Exposes REST/TRPC endpoints for Frontends (TMA, Client Panel).
- **Business Logic Hub**: Handles Event creation, Order processing, and User management.
- **Orchestrator**: Sends messages to RabbitMQ for async processing (Workers) and communicates with the NFT Manager.

## 2. API Structure (`src/server/routers`)
The API is organized into modular routers, likely using **TRPC** or a similar pattern.

### Core Domains
- **`events.ts`**: Event CRUD. Creating events, fetching details, searching.
- **`orders.ts`**: Order lifecycle. Creating orders, checking payment status.
- **`tickets.ts`**: Ticket retrieval and management.
- **`users.ts`**: User profile management.

### Integrations & Auth
- **`tonProofRouter.ts`**: Handles TON Wallet proof verification (TON Connect).
- **`usersXRouter.ts`, `usersGoogleRouter.ts`, etc.**: OAuth handlers for social login.
- **`telegramInteractions.ts`**: specialized logic for interacting with Telegram API.

### Gamification
- **`campaignRouter.ts`**: Managing promotional campaigns.
- **`raffleRouter.ts`**: Handling event raffles.
- **`questRouter.ts`**, **`tasksRouter.ts`**: Managing user engagement tasks.

## 3. Data Access
Uses **Drizzle ORM** (configured in `@/db`) to interact with the Postgres `mini-app` schema.
- See individual schema definitions in `src/db/schema/*.ts`.

## 4. Key Logic Pattern
Most routers follow a standard flow:
1.  **Validation**: Zod schemas (in `zodSchema/`) validate incoming request data.
2.  **Authorization**: Middleware checks user session/role.
3.  **DB Operation**: Drizzle performs the query/mutation.
4.  **Side Effects**: If needed, a message is published to RabbitMQ (e.g., "Send Confirmation Email").
