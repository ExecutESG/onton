# Onton Platform: Development & QA Process

> Last verified against dev: 2026-10-03

Local setup, tests and QA rules for the `ontonbot` repo (`github.com/ExecutESG/onton`).

## 1. Local development

### Prerequisites
- Docker Desktop
- Node.js 22 (used by `mini-app/Dockerfile` and CI)
- `yarn` (each app has its own `package.json`; there is no root `package.json`)

### Setup
1. Copy `.env.example` to `.env` at the repo root. App scripts read `../.env`.
2. Start services with a profile. Every service has a profile, so `docker compose up` without one starts nothing.
   - Full stack: `docker compose --profile full up -d`
   - Infra only (run the mini-app on the host): `docker compose --profile minimal up -d` or `--profile expecting-mini-app`
3. Mini App: `cd mini-app && yarn dev` (inits MinIO, then `next dev` on `MINI_APP_PORT`).
4. Bot: `cd telegram-bot && yarn dev`. Local bot is `@ontonlocaldevbot`.

Full guide: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

## 2. Automated tests

### Mini App unit/API tests (Vitest)
- Run: `cd mini-app && yarn test:api` (`vitest run`). This also runs in CI.
- Included files (`mini-app/vitest.config.ts`): `__tests__/**/*.test.ts`, `src/**/*.spec.ts`, `src/**/*.test.ts`. `.tsx` tests are **not** included.
- `yarn test` is not the test suite. It runs `src/test.ts` for ad-hoc checks.
- A `jest.config.ts` and `test:watch` (Jest) script exist, but the tests import from `vitest`. Use Vitest.
- Mock external services (Redis, MinIO, Postgres) in unit tests.

### E2E (Playwright, `tests/e2e`)
- Default suite: `npx playwright test` (target `BASE_URL`, default `https://app.dev.onton.live`).
- Real staging suite: `cd tests/e2e && npx playwright test -c playwright.real.config.ts`
  - Loads `.env.test` (see `.env.test.example`), runs `real/*.real.spec.ts` serially with 1 worker.
  - Has a production guard: it refuses to run against `app.onton.live`, `onton.live`, bot `theontonbot`, or the prod SSH host.
- QA portal: `npm run portal` from `tests/e2e` (files in `tests/quality-portal/`).
- `.github/workflows/scheduled-smoke-tests.yml` is manual only (cron is commented out).

### CI gates
- Before build: `mini-app` → `yarn lint:quiet` + `yarn test:api`; `telegram-bot` → `yarn run build` (`tsc`). Only for changed services.
- After deploy: Playwright `smoke.spec.ts`. This runs after the deploy, so a failure does not block it.
- See [deployment_pipeline.md](./deployment_pipeline.md).

## 3. Code quality
- ESLint per app (`yarn lint`; `mini-app` also has `lint:quiet`, `type:check`, `format`). `telegram-bot` has no lint script.
- Naming: React components `PascalCase`; files/dirs kebab- or lower-case; env keys `UPPER_SNAKE_CASE`.
- `devops/CheckoutEnv.sh` is not a plain validator: it needs `gh` auth, pings domains and can offer to add Cloudflare DNS records.

## 4. Pull requests
1. `mini-app`: `yarn lint:quiet` and `yarn test:api` pass.
2. Changed services build (`docker compose --profile full up -d --build <service>`).
3. PR describes purpose, run steps, and screenshots for UI changes.
4. QA issue templates live in `.github/ISSUE_TEMPLATE/` (`qa_bug_report.yml`, `release_uat_run.md`).

## 5. Runtime pieces relevant to QA
- RabbitMQ queues: `${STAGE_NAME}-notifications`, `-tg_messages`, `-order_paid`. The bot does not use RabbitMQ.
- ORM: Drizzle in `mini-app` (`src/db/schema.ts`). `newton/apps/nft-manager` (NestJS + Prisma) exists but is not deployed.
- Staging runs 0 workers, 0 sockets and no RabbitMQ, so worker, socket and queue flows must be tested locally.
- Migrations: apply SQL with `psql -v ON_ERROR_STOP=1`. Never `yarn db:migrate` (stale journal). See [migration_and_syncing.md](./migration_and_syncing.md).

## Known issues (tracked in QA)
- Vitest skips `.tsx` tests.
- The default Playwright config has no `testIgnore`, so a plain `npx playwright test` also picks up `real/*.real.spec.ts`.
- F-04: no automated prod deploy; the `main` smoke step targets prod while deploying to staging.
- No automated prod DB backups.
