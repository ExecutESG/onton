# ONTON Mini App Service Overview

> Last verified against dev: 2026-10-03

`mini-app/` is the core of ONTON. It is a Next.js app that serves the Telegram Mini App and the web app (attendees and organizers), the tRPC and REST APIs, and — through other entry points — the background workers and the notification socket.

## 1. Stack

| Item | Value |
|---|---|
| Framework | Next.js 14 (`14.2.28`), **App Router only** (no `src/pages`) |
| Language | TypeScript |
| API | tRPC (`src/server/routers/`) and REST route handlers (`src/app/api/`) |
| Database | PostgreSQL via Drizzle ORM |
| Client state | Zustand + TanStack Query |
| Styling | TailwindCSS, shadcn/ui (Radix, `src/components/ui/`), MUI |
| Real-time | Socket.io server (`src/sockets/index.ts`) |
| Tests | Vitest: `yarn test:api` |

## 2. Services built from this codebase

All workers reuse the `mini-app` image with a different command.

| Service | Command | What it runs |
|---|---|---|
| `mini-app` | `next start` | UI, tRPC, REST |
| `mini-app-notification-socket` | `start:socket` | Socket.io. Port from the required `SOCKET_PORT` env. |
| Payment scheduler | `start-cron-payment` (`src/workers/cronJobSchedulerPayment.ts`) | `CheckTransactions` (7 s), `MintNFTForPaidOrders` (9 s), `TsCsbtTicketOrder`, `CreateEventOrders`, `UpdateEventCapacity`, `OrganizerPromoteProcessing`, payment reminders, raffles, the `order_paid` consumer |
| `mini-app-reward-worker` | `start-cron-reward` | `CreateRewards`, reward notifications, tournament rewards, `CheckSbtStatus` (prod only) |
| `mini-app-ordinary-worker` | `start-cron-ordinary` | Block checks, invite-link cron, click batches, tournaments, promo codes, wallet balances (prod only) |
| `mini-app-nft-api-worker` / NFT-API scheduler | `start-cron-nft-api` (`src/workers/cronJobSchedulerNFTApi.ts`) | `deployNFTApiCollections`, `mintNFTApiCollections` (5 s each) |
| `mini-app-poa-worker` | `start:poa` (`src/workers/poaWorker.ts`) | Polls the DB every 4 s and creates PoA trigger notifications for ongoing events. No RabbitMQ. |

> [!WARNING]
> The `mini-app-sbt-worker` name is misleading. In local/prod `docker-compose.yml` it runs `start-cron-nft-api`, and a separate `mini-app-payment-worker` runs `start-cron-payment`. In `docker-compose-server.yml` and `docker-compose-server-dev.yml` the `sbt-worker` runs `start-cron-payment` and there is no payment-worker. On staging all workers and the socket run 0 replicas.

Play2Win UI is retired, but `checkAndEnrollUserInPlay2WinCampaign` (reward) and `syncPlay2WinScores` (ordinary) are still scheduled.

## 3. Directory structure

```text
mini-app/
├── drizzle/              # SQL migrations (apply by hand with psql)
├── src/
│   ├── app/              # App Router pages, layouts, REST routes (app/api/)
│   ├── components/       # React components (ui/ = shadcn)
│   ├── db/               # schema.ts, schema/, modules/ (queries)
│   ├── server/
│   │   ├── index.ts      # appRouter
│   │   ├── routers/      # tRPC routers
│   │   ├── trpc.ts       # procedure types
│   │   └── context.ts    # auth context
│   ├── services/         # e.g. sbtService.ts
│   ├── lib/              # tgBot.ts, rabbitMQ.ts, totp/, csbt/, nft, ...
│   ├── cronJobs/         # cron task logic
│   ├── workers/          # worker entry points
│   ├── sockets/          # Socket.io server
│   └── moderationBot/    # leftover helpers/menu/types used by the mini-app
└── package.json
```

## 4. API and data

- tRPC routers live in `src/server/routers/` and are combined into `appRouter` in `src/server/index.ts`. See [backend_mini_app.md](backend_mini_app.md).
- Drizzle schema: `src/db/schema.ts` (used by `drizzle.config.ts`) plus `src/db/schema/`.

> [!CAUTION]
> Never run `yarn db:migrate`; the Drizzle journal is stale. Apply new SQL files with `psql -v ON_ERROR_STOP=1 -f mini-app/drizzle/<file>.sql`. `yarn db:up` is `drizzle-kit up` (snapshot upgrade), not a migration.

## 5. Commands

| Command | Description |
|---|---|
| `yarn dev` | Inits MinIO and starts `next dev` on `MINI_APP_PORT` using `../.env` |
| `yarn build && yarn start:local` | Production build, run locally |
| `yarn lint` / `yarn lint:quiet` | Lint (CI runs `lint:quiet`) |
| `yarn type:check` | Type check |
| `yarn test:api` | Vitest unit tests (CI) |
| `yarn db:gen` | Generate SQL from schema changes (`drizzle-kit generate`) |
| `yarn start:socket` / `yarn start:poa` | Socket server / PoA worker |
| `yarn local:start-cron-<payment\|reward\|ordinary\|nft-api>` | Workers with `../.env` |

## 6. Payments

| Rail | Flow |
|---|---|
| Free | `POST /api/v1/order` creates a `completed` order and a ticket right away. |
| TON / USDT (jetton) | Order `confirming` → `CheckTransactions` (TonCenter v3, memo `onton_order=<id>`) sets `processing` → `MintNFTForPaidOrders` mints the NFT and sets `completed`. |
| Telegram Stars | The bot's `successful_payment` handler sets `completed` directly. No NFT mint. |

There is no `PAID` order state. Details: [payment_system_overview.md](payment_system_overview.md).

## 7. Integration points

- **Telegram bot**: the mini-app calls the bot's HMAC-signed HTTP API (`src/lib/tgBot.ts`, port `TELEGRAM_BOT_PORT`, default 3333) to send messages, photos, files, invites and Stars invoices.
- **MinIO**: object storage (images, NFT/SBT metadata).
- **RabbitMQ**: `${STAGE_NAME}-notifications` (with a DLX + 5 s retry queue), `-tg_messages` and `-order_paid` (`src/sockets/constants.ts`, `src/lib/rabbitMQ.ts`). Not deployed on staging.
- **Redis**: caching, locks, rate limits, socket adapter.

## Known issues (tracked in QA)

- F-35: the `order_paid` consumer is likely failing; the `MintNFTForPaidOrders` cron is the real fulfillment path.
- F-33: Stars pre-checkout approves without validating order, price or capacity.
- F-34: paid tier `sold_count` is not incremented; no tier-creation API.
