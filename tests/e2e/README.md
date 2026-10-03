# End-to-End (E2E) & Smoke Tests

> Last verified against dev: 2026-10-03

Playwright (`@playwright/test` ^1.42) suites for ONTON. Two configs:

| Config | Target | Scope |
|---|---|---|
| `playwright.config.ts` | `BASE_URL`, default `https://app.dev.onton.live` | All `*.spec.ts` in this folder. 2 workers, projects chromium + Pixel 5, video/screenshots on. Helpers include mocks (`helpers/telegram-mock.ts`, `helpers/trpc-mock.ts`). |
| `playwright.real.config.ts` | Real staging backend | `real/*.real.spec.ts` only. Serial, 1 worker, 60s timeout, `forbidOnly`, global setup `real/global-setup.ts`. |

## Setup

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

## Smoke tests

```bash
# Staging (default BASE_URL)
npx playwright test smoke.spec.ts

# Production (read-only smoke only)
BASE_URL=https://app.onton.live npx playwright test smoke.spec.ts
```

> [!WARNING]
> `npm test` runs `playwright test` with no filter. Because `testDir` is `./` and there is no `testIgnore`, it also picks up `real/*.real.spec.ts`. Pass a file name, or use the real config explicitly.

## Real staging suite

```bash
cd tests/e2e
cp .env.test.example .env.test   # fill in staging values
npx playwright test -c playwright.real.config.ts
```

- Loads `.env.test` and calls `assertNotProduction()` (`helpers/envTest.ts`). It throws if the target host is `app.onton.live`/`onton.live`, the bot is `theontonbot`, or `E2E_STAGING_SSH` points at the production host.
- Required variables are listed in `.env.test.example` (staging bot token, test Telegram IDs for organizer/attendee/officer/admin, testnet buyer mnemonic, `BASE_URL`, `NEXT_PUBLIC_BOT_USERNAME`, `E2E_STAGING_SSH`, fixture event UUIDs).
- Specs: `real/auth.real.spec.ts`, `real/flows.real.spec.ts`. Fixtures: `real/reset-fixtures.sh`.
- Use the staging bot `@notnonstagebot` only. Never point tests at `@theontonbot`.

## Other scripts (`package.json`)

| Script | Command |
|---|---|
| `test` | `playwright test` |
| `test:headed` | `playwright test --headed` |
| `test:report` | `playwright show-report` |
| `test:quality` | `playwright test` then `../quality-portal/generate-portal-data.js` |
| `portal` | `node ../quality-portal/serve.js` (QA portal in `tests/quality-portal/`) |

## CI

- **Post-deploy smoke**: `.github/workflows/build-push-deploy.yml` runs `npx playwright test smoke.spec.ts` after each deploy. `dev` targets `https://app.dev.onton.live`. `main` targets `https://app.onton.live`, although `main` is deployed to the staging host (F-04).
- **Scheduled smoke**: `.github/workflows/scheduled-smoke-tests.yml` has its cron commented out. It runs only on manual dispatch (`dev` or `production` target) and runs `npx playwright test` with no file filter.
