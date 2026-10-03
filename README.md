# ONTON - Event Manager on Telegram and the Web

<p align="center">
  <img src="logo.png" alt="Onton Logo" />
</p>

ONTON is an event platform that runs as a Telegram Mini App and as a web app. Organizers create events, sell tickets and check attendees in; attendees register, pay and collect credentials.

## Features
- **Events**: free events publish immediately, with post-publish moderation and abuse reports.
- **Registration**: approval, capacity and waitlist with auto-promotion.
- **Tickets & payments**: TON, USDT (jetton) and Telegram Stars.
- **Check-in**: rotating QR pass tokens scanned by event managers.
- **Credentials**: native TEP-85 SBT badges and proof of attendance.
- **Login**: Telegram, Google and email, with linked identities.

## Repository layout
| Path | What |
|---|---|
| `mini-app/` | Main Next.js app (Mini App + web, tRPC, workers, sockets, SQL migrations) |
| `telegram-bot/` | grammY bot and its HTTP API |
| `website/` | Public website |
| `client-web-panel/` | Legacy organizer panel (local only) |
| `devops/` | Caddy, env and backup helpers |
| `tests/e2e/` | Playwright tests |

## Getting started
1. `cp .env.example .env` (root `.env`; all apps read it).
2. `docker compose --profile full up -d` (every service has a profile; plain `up` starts nothing).
3. First run: `cd mini-app && yarn run init:minio:local`.
4. Unit tests: `cd mini-app && yarn test:api`.

Never run `yarn db:migrate`; apply SQL from `mini-app/drizzle/` with `psql -v ON_ERROR_STOP=1`.

More:
- Agent/contributor rules: [`AGENTS.md`](AGENTS.md)
- Developer onboarding: [`docs/technical_onboarding.md`](docs/technical_onboarding.md)
- Knowledge base: [`knowledge_base/Knowledge_Index.md`](knowledge_base/Knowledge_Index.md)
- Production deploy: [`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)

## Issues
- Repository: [github.com/ExecutESG/onton](https://github.com/ExecutESG/onton)
- Report or track issues: [ExecutESG/onton issues](https://github.com/ExecutESG/onton/issues)
