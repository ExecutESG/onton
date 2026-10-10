# ONTON Telegram Bot Service Overview

> Last verified against dev: 2026-10-03

`telegram-bot/` is a grammY bot plus an Express HTTP API. It handles Telegram commands, moderation callbacks and Telegram Stars payments, and it sends messages, files and invites on behalf of the mini-app.

See also: [backend_bot_commands.md](backend_bot_commands.md), [backend_telegram_bot.md](backend_telegram_bot.md).

## 1. Stack

| Item | Value |
|---|---|
| Runtime | Node.js, TypeScript |
| Bot framework | grammY (`telegram-bot/src/main.ts`) |
| HTTP API | Express (`main.ts`) |
| Database | PostgreSQL via `pg` (`telegram-bot/src/db/`) |
| Redis | Rate limiter only |
| Sessions | grammY default in-memory `session({ initial })`, no storage adapter. State is lost on restart. |
| Storage | MinIO client (`minio` package) |
| Prod start | `ts-node` (`telegram-bot/package.json`) |
| Lint | None. Use `yarn build` (tsc). CI runs `yarn build`. |

## 2. Responsibilities

1. Commands from admins and organizers (see [backend_bot_commands.md](backend_bot_commands.md)).
2. Post-publish moderation callbacks (`telegram-bot/src/composers/moderationComposer.ts`). The separate mini-app moderation bot was removed (commit 3b51b56e).
3. Telegram Stars payments (`telegram-bot/src/handlers/starsPaymentHandler.ts`, `telegram-bot/src/controllers/starsInvoiceHandler.ts`).
4. HMAC-protected HTTP API used by the mini-app (`mini-app/src/lib/tgBot.ts`).
5. Crons: `pollSenderCron` and `broadcastSenderCron`, both every 10 s (`telegram-bot/src/cronJobs/initializer.ts`). The log line in `main.ts` that says "every 2 minutes" is wrong.

The bot does **not** use RabbitMQ.

## 3. Directory structure

```text
telegram-bot/src/
├── main.ts          # bot + Express setup, command registration
├── composers/       # grammY composers (commands, moderation callbacks)
├── handlers/        # /start, /org, /cmd, /banner, Stars payments, ...
├── controllers/     # Express route handlers
├── middleware/      # hmacAuth.ts
├── cronJobs/        # poll and broadcast senders
├── db/              # SQL queries (pg)
└── lib/, utils/     # helpers (deep links, Redis, ...)
```

## 4. HTTP API

Port: `TELEGRAM_BOT_PORT` (default 3333). All routes except `/health` pass `hmacAuthMiddleware` (`telegram-bot/src/middleware/hmacAuth.ts`): HMAC-SHA256 over `timestamp.body` with a 60 s replay window. Secret: `BOT_API_HMAC_SECRET` (falls back to other secrets if unset; set it in every environment).

| Method | Route |
|---|---|
| GET | `/health` (no auth) |
| POST | `/send-file` |
| GET | `/generate-qr` |
| POST | `/share-event` |
| POST | `/send-message` |
| POST | `/send-photo` |
| POST | `/share-organizer` |
| POST | `/share-tournament` |
| POST | `/check-block-status` |
| POST | `/check-bot-admin` |
| POST | `/create-invite` |
| POST | `/delete-invite` |
| POST | `/create-stars-invoice` |
| POST | `/share-affiliate-link` |
| POST | `/share-join-onton-link-affiliate` |

## 5. Middleware and runtime

- Rate limit: Redis-backed, 10 commands per minute per user (`main.ts`, `telegram-bot/src/constants.ts`).
- `/start` resets the session (`main.ts`, `handlers/startHandler.ts`).
- Long polling with `drop_pending_updates`. Run a single replica per bot token, otherwise Telegram returns polling conflicts.
- Stars handlers are registered before the composers (`main.ts`).

## 6. Telegram Stars flow

1. Mini-app `POST /api/v1/order/stars-invoice` converts the order price with fixed pegs and calls the bot's `/create-stars-invoice`, which calls `createInvoiceLink` with currency `XTR`.
2. Frontend opens the invoice with `webApp.openInvoice` (`CheckoutForm.tsx`).
3. `pre_checkout_query` is approved.
4. `successful_payment` sets the order to `completed`, approves the registrant, inserts a ticket row if missing, creates a 1-use group invite and replies with a button to `/tickets/<event_uuid>`.

The Stars path does not mint an NFT, does not publish `order_paid`, and does not increment affiliate or tier counters.

## 7. Environments

| Env | Bot |
|---|---|
| Production | `@theontonbot` |
| Staging | `@notnonstagebot` |
| Local | `@ontonlocaldevbot` |

The runtime `.env` is the source of truth for the bot identity.

## Known issues (tracked in QA)

- F-33: Stars pre-checkout approves without validating order, price or capacity.
- Secret env vars have insecure fallbacks if unset; set them in every environment.
