# Onton Platform Overview

> Last verified against dev: 2026-10-03

ONTON (`ontonbot` repo, `github.com/ExecutESG/onton`) is a Telegram Mini App for event management, ticketing and on-chain credentials on TON.

## Project structure
| Path | What |
| :--- | :--- |
| `mini-app/` | Next.js (App Router) Mini App + tRPC API + workers + sockets. Drizzle ORM, migrations in `drizzle/`. |
| `telegram-bot/` | grammY bot + Express API (HMAC-protected). Includes moderation. |
| `website/` | Next.js marketing site. |
| `client-web-panel/` | Next.js (pages router) organizer panel. Local compose only. |
| `newton/apps/nft-manager/` | NestJS + Prisma service. Not deployed. |
| `devops/` | Caddy, env and backup scripts. |
| `tests/e2e/` | Playwright suites. |

- Data: one PostgreSQL instance (`mini-app` DB via Drizzle), Redis, MinIO, RabbitMQ.
- `participant-tma` is decommissioned; `/ptma` links are handled by 4 rewrites in `mini-app/next.config.js`.

## Environments
- Production: `65.109.212.86`, plain `docker compose` (`local-onton`), deployed manually.
- Staging: `65.109.182.13`, Docker Swarm stack `onton-dev`, deployed by CI.
- Details: [deployment_and_infrastructure.md](./deployment_and_infrastructure.md).

## Documentation guide

### Repository docs (`docs/`)
- `docs/architecture_and_design.md`: domain models and flows.
- `docs/technical_onboarding.md`: onboarding notes. Parts are outdated (Node version, participant-tma, prod orchestration); prefer [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

### Knowledge base
- [deployment_and_infrastructure.md](./deployment_and_infrastructure.md): hosts, manual prod deploy, backups (manual only).
- [deployment_pipeline.md](./deployment_pipeline.md): GitHub Actions build and deploy.
- [manual_db_maintenance.md](./manual_db_maintenance.md): manual DB dumps.
- [migration_and_syncing.md](./migration_and_syncing.md): applying SQL migrations; copying prod to another server.
- [project_ownership_and_recovery.md](./project_ownership_and_recovery.md): secrets, rotation, recovery.
- [development_and_qa.md](./development_and_qa.md): local setup, Vitest and Playwright, PR rules.
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md): onboarding and code layout.

## Key patterns
- API: tRPC routers in `mini-app/src/server/routers/`; REST routes in `mini-app/src/app/api/`.
- Validation: Zod (`mini-app/src/zodSchema/`).
- Auth: Telegram initData, platform JWT (Bearer/cookie), email OTP, Google, Telegram widget. Accounts link through the `user_identities` table.
- Events: free events publish immediately and get a post-publish moderation alert; paid events stay hidden until the creation order is paid. `ts_verified` gating is retired. Hub defaults to "Onton" when none is chosen; there is no hub eligibility check.
- Rate limits: edge rate limiting in `mini-app/src/middleware.ts`; per-route limits (e.g. `POST /api/v1/order` 20/min per user, auth routes 30/min).

## Known issues (tracked in QA)
- No automated prod DB backups.
- F-04: CI deploys `main` to the staging host; no automated prod deploy.
- F-27: email OTP codes are logged, not emailed.
