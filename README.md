# ONTON: Events with Verified Attendance

<p align="center">
  <img src="logo.png" alt="Onton Logo" />
</p>

Create an event in a minute. Free events are free forever. Verified attendance, built in.

ONTON is a reliable Luma alternative running as a Telegram Mini App and web platform. Organizers launch events with free onboarding, sell tickets with Telegram Stars or crypto (3% fee), and manage door entry with high-speed rotating QR passes. Attendees register in one tap without wallet friction and receive permanent, portable attendance credentials.

332K people with attendance credentials · 633K verified in-person check-ins.

## Features
- **Fast Event Creation**: Free events publish immediately, with post-publish moderation and abuse reports. Free organizer onboarding.
- **1-Tap RSVP & Registration**: Instant attendee registration without wallet requirements, plus capacity limits, approval flows, and automated waitlist promotion.
- **Door Check-In**: High-speed check-in using rotating QR pass tokens scanned by event managers.
- **Verified Attendance & Credentials**: Digital attendance credentials and optional on-chain TEP-85 SBT badges that attendees keep forever.
- **Flexible Ticketing & Low Fees**: Accept Telegram Stars (in-app card payments) and crypto (TON, USDT jetton) with low 3% ticket fees.
- **Telegram Native**: Automated attendee group chat gating via single-use invite links.
- **Flexible Login**: Telegram, Google, and email authentication with linked identities.

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
