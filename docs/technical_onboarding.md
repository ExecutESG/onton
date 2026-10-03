# ONTON Technical Onboarding Guide

> Last verified against dev: 2026-10-03

## 1. Project overview
ONTON is an event platform for Telegram and the web. The repo is a set of independent apps (no root `package.json`) run with Docker Compose.

### Core technologies
- **Apps**: Next.js (mini-app: App Router + tRPC, TypeScript), grammY Telegram bot, Next.js website.
- **Data/infra**: Postgres 16, Redis 7 (no persistence), RabbitMQ 4 (local/prod compose only), MinIO, ClamAV, Caddy.
- **Package manager**: `yarn` per app (`client-web-panel` pins pnpm).

## 2. Prerequisites
- Docker Desktop
- Node.js 22 (matches `mini-app/Dockerfile` and CI)
- Git

## 3. Project structure

```
onton/
├── mini-app/                  # Main app: Telegram Mini App + web, tRPC, REST, workers, sockets, drizzle/ SQL
├── telegram-bot/              # grammY bot + HMAC-protected HTTP API
├── website/                   # Public website (blog, event directory)
├── client-web-panel/          # Legacy organizer panel (JS, local compose only)
├── newton/apps/nft-manager/   # NestJS + Prisma; not deployed
├── devops/                    # Caddy, env and backup helpers
├── swagger/                   # API docs
├── tests/e2e/                 # Playwright suites
├── docker-compose.yml         # Local dev and production (--profile full)
├── docker-compose-server.yml  # Swarm stack "onton" (CI, main branch, staging host)
└── docker-compose-server-dev.yml # Swarm stack "onton-dev" (staging)
```

`newton/apps/participant-tma` was removed. Its old `/ptma/...` URLs are served by 4 rewrites in `mini-app/next.config.js`.

## 4. Local development setup

### Step 1: Clone
```bash
git clone https://github.com/ExecutESG/onton.git
cd onton
```

### Step 2: Configure environment
```bash
cp .env.example .env
```
All apps read the root `.env` (e.g. mini-app scripts use `../.env`).

### Step 3: Start services
Every compose service has a profile; `docker compose up` alone starts nothing.
```bash
# Full stack
docker compose --profile full up -d
docker compose --profile full ps

# Infra only, then run apps with yarn dev
docker compose --profile minimal up -d
```
Stop with `docker compose --profile full down`. Do not add `-v` unless you want to delete the named volumes (`pgadmin`, `clamav_data`, `rabbitmq_data`).

First run: `cd mini-app && yarn run init:minio:local`.

### Step 4: Ports
Ports come from `.env`: `MINI_APP_PORT`, `PORT_WEB_SITE`, `PORT_CLIENT_WEB`, `TELEGRAM_BOT_PORT`, `SOCKET_PORT`, etc.

### Step 5: Tests
- mini-app unit tests (Vitest): `cd mini-app && yarn test:api`
- Lint: `yarn lint` (mini-app, website, client-web-panel). telegram-bot: `yarn build` (tsc).
- E2E: see [`tests/e2e/README.md`](../tests/e2e/README.md).

### Step 6: Database migrations
- Never run `yarn db:migrate` (stale Drizzle journal).
- Apply SQL from `mini-app/drizzle/` with `psql -v ON_ERROR_STOP=1 -f <file>.sql`.

## 5. Environments and deployment

| Env | Host | Runtime | Deploy |
|---|---|---|---|
| Production | 65.109.212.86 | Plain `docker compose` project `local-onton` in `/root/ontonbot` (`--profile full`) | Manual |
| Staging | 65.109.182.13 | Swarm stack `onton-dev` | CI on push to `dev` |

- CI also deploys `main` (stack `onton`) to the staging host. It never deploys production (F-04).
- Production deploy steps: [`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`](./PRODUCTION_DEPLOYMENT_GUIDE.md). In short: `git pull origin main`, apply SQL with psql, `docker compose --profile full up -d --build`.
- There are no automated production DB backups. Take a manual dump before risky changes ([`knowledge_base/manual_db_maintenance.md`](../knowledge_base/manual_db_maintenance.md)).

## 6. Troubleshooting

### TLS / Caddy
- The Caddy image is built from `devops/caddy/Dockerfile` with the Cloudflare DNS plugin. Certificate issues usually involve `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_EMAIL` in `.env`.

### Build failures (env vars)
- Next.js builds need `NEXT_PUBLIC_*` variables at build time. Make sure `.env` has values for them (e.g. `NEXT_PUBLIC_BOT_USERNAME`).

### Database data directory
- `data/db_data` is the **live** Postgres bind mount, not a backup. Do not edit it while Postgres runs. For backups use `pg_dump`/`pg_dumpall` as described in `knowledge_base/manual_db_maintenance.md`.
