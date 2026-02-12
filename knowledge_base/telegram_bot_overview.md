# ONTON Telegram Bot Service Overview

The `telegram-bot` service is a specialized Node.js application responsible for all direct interactions with the Telegram Platform API. It uses the **Grammy** framework to handle user commands and **Express** to provide an internal API for other services.

## 1. Technology Stack

*   **Runtime:** Node.js (TypeScript)
*   **Bot Framework:** [Grammy](https://grammy.dev/)
*   **API Server:** Express.js
*   **Database:** PostgreSQL (Direct connection via `pg`) & Redis (Session storage)
*   **Process Manager:** `ts-node` (Dev) / `node` (Prod)
*   **Storage:** MinIO (S3) for file uploads

## 2. Core Responsibilities

1.  **User Interaction:** Handles commands like `/start`, `/org`, `/cmd` directly from Telegram users.
2.  **Internal Notification Gateway:** The Mini App calls this service to send messages, files, or notifications to users (bypassing the need for the Mini App to hold the Bot Token directly).
3.  **Cron Jobs:** Runs the `PollSenderCron` to broadcast polls or scheduled messages.
4.  **Admin Tools:** Provides commands for admins to update profiles or check stats.

## 3. Key Directory Structure

```text
telegram-bot/
├── src/
│   ├── main.ts             # Entry point (Bot + Express setup)
│   ├── composers/          # Middleware & routing logic (Grammy composers)
│   ├── controllers/        # Express Route Handlers (Internal API)
│   │   ├── sendMessage.ts
│   │   ├── handleFileSend.ts
│   │   └── ...
│   ├── handlers/           # Telegram Command Handlers
│   │   ├── startHandler.ts
│   │   ├── cmdHandler.ts
│   │   └── ...
│   ├── cronJobs/           # Background tasks (PollSender)
│   ├── db/                 # Database queries
│   └── lib/                # External services (Redis, etc.)
└── package.json
```

## 4. Internal API Endpoints

The `telegram-bot` exposes an HTTP server (default port `3333`) strictly for internal use by the `mini-app` or workers.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/send-message` | Sends a text message to a user. |
| `POST` | `/send-file` | Uploads and sends a file to a user. |
| `POST` | `/generate-qr` | Generates a QR code for a specific link. |
| `POST` | `/share-event` | Sends an event card to a user. |
| `POST` | `/check-bot-admin` | Checks if the bot is an admin in a channel. |

## 5. Middleware & Logic

*   **Rate Limiting:** Implemented in `main.ts` using Redis. Limits users to ~10 commands/minute to prevent spam.
*   **Session Management:** Uses Redis to store conversation state (e.g., multi-step forms).
*   **Admin Checks:** Middleware protects sensitive commands by verifying user IDs against the admin list.

## 6. How it runs
The `src/main.ts` file does two things in parallel:
1.  **Starts the Bot:** `bot.start()` (Long polling mode).
2.  **Starts Express:** `app.listen(3333)`.

> **Note:** In production (Docker Swarm), this service runs as a single replica to avoid "conflict" errors with long polling (unless using Webhooks, but the current code uses polling `bot.start()`).

## 7. Common Commands

*   `/start` - User onboarding & welcome message.
*   `/org` - Organizer tools menu.
*   `/cmd` - List of available commands.
*   `/banner` - Banner management (Admin).
*   `/update_profiles` - Sync admin profiles (Admin).
