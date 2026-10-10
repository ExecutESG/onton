# Repository Guidelines

Last verified against dev: 2026-10-03

## Project Structure & Module Organization
- `mini-app/`: Next.js App Router (TypeScript) Telegram Mini App + web app. tRPC routers in `src/server/routers/`, REST routes in `src/app/api/`, cron workers in `src/workers/`, socket server in `src/sockets/`, Drizzle SQL migrations in `drizzle/`.
- `telegram-bot/`: grammY + Express bot service (commands, moderation callbacks, Stars payments, HMAC-protected HTTP API for the mini-app).
- `client-web-panel/`: legacy Next.js (JS, pages router) organizer panel. Local compose only; not deployed by the server compose files.
- `website/`: Next.js public site (blog, event directory, glossary).
- `newton/apps/nft-manager/`: NestJS + Prisma service. Not in any compose file; its loops are commented out.
- `devops/`: Caddy, env and backup helpers. `docker-compose.yml` (local + prod), `docker-compose-server.yml` / `docker-compose-server-dev.yml` (Swarm stacks). API docs in `swagger/`. E2E tests in `tests/e2e/`.
- There is no root `package.json`; install per app.

## ONTON 2.0 at a glance
- Auth: Telegram initData, Telegram Login Widget, Google OAuth and email OTP. Logins issue a 7-day platform JWT. Identities live in `user_identities` (migration `0123`). Wallets are proven with TonProof (`src/server/routers/tonProofRouter.ts`).
- Free events publish immediately. Moderation happens after publishing (Delist / Warn / Ban / Update), and 3 abuse reports within 1h auto-quarantine an event. Moderation lives in `telegram-bot/src/composers/moderationComposer.ts`; the separate moderation-bot service is removed.
- Registration: approval, capacity and waitlist, with auto-promotion from the waitlist.
- Check-in: rotating pass tokens (`src/lib/totp/passToken.ts`, 20s step). Static UUID passes are rejected at the scan step. Check-in procedures are restricted to event managers; pass tokens are owner only.
- Payments: TON and USDT (jetton) are verified by the `CheckTransactions` cron (TonCenter v3, every 7s) and fulfilled by the `MintNFTForPaidOrders` cron (every 9s). Telegram Stars are completed in the bot. Ticket tiers live in `event_ticket_tiers` (migration `0125`).
- Credentials: native TEP-85 SBTs (`src/services/sbtService.ts`, `src/server/routers/sbt.ts`). `mintBadge` is global-admin only. `claimAttendanceSbt` / `materializeOnChainSbt` are ticket-owner only. cSBT Merkle proofs: `src/lib/csbt/`, `GET /api/v1/csbt/proof`.
- participant-tma is decommissioned. `mini-app/next.config.js` has 4 explicit `/ptma` rewrites.

## Build, Test, and Development Commands
- Docker (full stack): `docker compose --profile full up -d`. Every service has a profile, so `docker compose up` with no `--profile` starts nothing. Infra only: `--profile minimal` or `--profile expecting-mini-app`.
- Stop: `docker compose --profile full down`. **Warning:** `down -v` deletes the named volumes (`pgadmin`, `clamav_data`, `rabbitmq_data`). Postgres data is a bind mount at `./data/db_data`.
- Mini App: `cd mini-app && yarn dev` (uses `../.env`). Build/start: `yarn build && yarn start:local`.
- Telegram Bot: `cd telegram-bot && yarn dev` or `yarn start:local`.
- Client Web: `cd client-web-panel && yarn dev`. Website: `cd website && yarn dev`.
- MinIO init (first run): `cd mini-app && yarn run init:minio:local`.

## Database Migrations (STRICT)
- **Never run `yarn db:migrate`.** The Drizzle journal is stale (snapshots end at `0117`).
- Use the tracked migration runner in `mini-app`:
  - Check status: `cd mini-app && yarn db:migrate:status` (or `yarn db:migrate:check`)
  - Apply pending SQL files: `cd mini-app && yarn db:migrate:apply` (runs pending migrations sequentially in transactions and records them in `_schema_migrations`).
  - Or apply by hand: `psql -v ON_ERROR_STOP=1 -f mini-app/drizzle/<file>.sql`
- `yarn db:up` is `drizzle-kit up` (snapshot upgrade). It is not a migration.

## Coding Style & Naming Conventions
- Language: TypeScript, Next.js, Node. Indent 2 spaces; avoid unused imports.
- Lint: `yarn lint` (or `yarn lint:quiet`) in `mini-app`, `client-web-panel`, `website`. `telegram-bot` has no lint script; use `yarn build` (tsc) there. Type check in mini-app: `yarn type:check`.
- Naming: React components PascalCase (`TicketList.tsx`); files/dirs kebab- or lower-case; env keys UPPER_SNAKE_CASE.
- Imports: use app aliases where defined (e.g., `@/` in `mini-app` maps to `src/`).

## Testing Guidelines
- Mini App unit tests use **Vitest**: `cd mini-app && yarn test:api`. `vitest.config.ts` includes `__tests__/**/*.test.ts`, `src/**/*.spec.ts` and `src/**/*.test.ts`; `.tsx` tests are not picked up. CI runs this.
- `jest.config.ts` exists but the tests import from `vitest`. Do not use `npx jest`.
- `yarn test` runs `src/test.ts` (ad-hoc checks only).
- Mock external services (Redis/MinIO/Postgres) in unit tests; avoid network I/O.
- E2E (Playwright, `tests/e2e/`): `npx playwright test smoke.spec.ts` for smoke. Real staging suite: `cd tests/e2e && npx playwright test -c playwright.real.config.ts` (needs `.env.test`; refuses production targets).

## Deployment reality
| Env | Host | How it runs | How it is deployed |
|---|---|---|---|
| Production | 65.109.212.86 | Plain `docker compose` project `local-onton` (`--profile full`, built on the server) | Manually. No CI deploy. |
| Staging | 65.109.182.13 | Docker Swarm stack `onton-dev` (`docker-compose-server-dev.yml`) | CI on push to `dev` |
- CI (`.github/workflows/build-push-deploy.yml`) deploys `dev` **and** `main` to the staging host (`main` as stack `onton`, `docker-compose-server.yml`). A `main` push does not deploy production (F-04).
- On staging, all workers and the socket run 0 replicas and there is no RabbitMQ.
- There are no automated production DB backups. The scripts in `devops/backup_scripts/` must be scheduled by hand.

## Commit & Pull Request Guidelines
- Commits: conventional and scoped, e.g. `fix(mini-app): ...`, `feat(telegram-bot): ...`.
- PRs: include purpose, linked issues, run instructions, and screenshots for UI. CI runs `yarn lint:quiet` + `yarn test:api` (mini-app) and `yarn build` (telegram-bot) for changed services.

## Security & Configuration Tips
- Copy `.env.example` to the repo root `.env`; never commit secrets.
- `devops/CheckoutEnv.sh` is not a plain validator: it needs `gh` auth, pings `*_DOMAIN` hosts and offers to create Cloudflare DNS records. Run it only when you mean to.
- Set `AUTH_JWT_SECRET`, `TOTP_SECRET`, `ONTON_API_SECRET` and `BOT_API_HMAC_SECRET` in every environment. Code falls back to weaker or default values when they are unset.
- Local domains/ports come from `.env` and Compose.

## Bot Identities & Environment Mapping (STRICT GUARDRAIL)
- **Production**: `@theontonbot` — NEVER send commands, test invoices, or mutations to production.
- **Staging**: `@notnonstagebot` — Staging bot entity for integration testing on staging environment.
- **Local Dev**: `@ontonlocaldevbot` — Configured in local `.env` (`NEXT_PUBLIC_BOT_USERNAME`, `BOT_TOKEN`).
- **Rule for Agents**: NEVER infer bot identities from marketing websites, blogs, or mock data. Runtime `.env` and environment variables are the sole sources of truth. Non-prod automated tests must reject `@theontonbot`.

## Mermaid Diagrams
- Supported headers ONLY: `flowchart TD/LR`, `graph TD/LR`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`, `xychart-beta`.
- NEVER use `mindmap`, `gantt`, `timeline`, or `pie` — use `flowchart TD` or Markdown tables instead.

## Docs
- Knowledge base index: `knowledge_base/Knowledge_Index.md`.
