# Telegram Bot Service

> Last verified against dev: 2026-10-03

`telegram-bot/` (`ontonbot/telegram-bot`) handles direct Telegram interaction. Full details: [telegram_bot_overview.md](telegram_bot_overview.md) and [backend_bot_commands.md](backend_bot_commands.md).

## 1. Core functions

- Commands for admins and organizers (`/start`, `/org`, `/banner`, `/broadcast`, `/invitor`, `/affiliate`, ...).
- Moderation callbacks for published events (`composers/moderationComposer.ts`).
- Telegram Stars invoices and payments (`controllers/starsInvoiceHandler.ts`, `handlers/starsPaymentHandler.ts`).
- Message, photo, file, invite-link and share-card delivery for the mini-app via an HTTP API.
- Poll and broadcast sending crons (every 10 s).

There is no support/FAQ forwarding handler.

## 2. Architecture

- Framework: **grammY** plus **Express** (`telegram-bot/src/main.ts`).
- `/start` is `handlers/startHandler.ts`, registered in `main.ts`. There is no `start.composer.ts`.
- Layout:
  - `composers/`: command flows and moderation callbacks, combined in `composers/index.ts`.
  - `handlers/`: command handlers registered in `main.ts`, plus Stars payment handlers.
  - `controllers/`: Express route handlers.
  - `middleware/hmacAuth.ts`: HMAC check for the HTTP API.
  - `cronJobs/`: `pollSenderCron`, `broadcastSenderCron`.
- Sessions are in memory (grammY default). Redis is used only for the rate limiter.

## 3. Integration

- The mini-app calls the bot's HTTP API (`mini-app/src/lib/tgBot.ts`), signed with HMAC (`BOT_API_HMAC_SECRET`).
- The bot reads and writes PostgreSQL directly via `pg` (e.g. Stars payments update `orders`, `event_registrants`, `tickets`).
- The bot does **not** use RabbitMQ.
