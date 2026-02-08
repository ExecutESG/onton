# Repository Guidelines

## Project Structure & Module Organization
- `mini-app/`: Next.js (TypeScript) Telegram Mini App with workers and sockets; Drizzle migrations in `drizzle/`.
- `telegram-bot/`: Node/TypeScript bot service.
- `newton/apps/participant-tma/`: Next.js participant-facing TMA (pnpm workspace).
- `client-web-panel/`: Next.js admin/client panel.
- `website/`: Next.js marketing site.
- `devops/`: Docker, Caddy, env helpers; `docker-compose.yml` orchestrates services. Assets and volumes under `data/`. API docs in `swagger/`.

## Build, Test, and Development Commands
- Docker (full stack): `docker compose --profile full up -d` | down: `docker compose down -v`.
- Mini App: `cd mini-app && yarn dev` (uses `../.env`); build/start: `yarn build && yarn start:local`.
- Telegram Bot: `cd telegram-bot && yarn dev` or `yarn start:local`.
- Participant TMA: `cd newton/apps/participant-tma && pnpm dev`; build: `pnpm build`.
- Client Web: `cd client-web-panel && yarn dev`; Website: `cd website && yarn dev`.
- MinIO init (first run): `cd mini-app && yarn run init:minio:local`.

## Coding Style & Naming Conventions
- Language: TypeScript, Next.js, Node. Indent 2 spaces; avoid unused imports.
- Lint/Format: ESLint and Prettier configured per app. Run `yarn lint` or `pnpm lint`; format with Prettier where available.
- Naming: React components PascalCase (`TicketList.tsx`); files/dirs kebab- or lower-case; env keys UPPER_SNAKE_CASE.
- Imports: use app aliases where defined (e.g., `@/` in `mini-app` maps to `src/`).

## Testing Guidelines
- Mini App: Jest is configured; place tests in `mini-app/__tests__/*.test.ts(x)`. Run `npx jest` (or add a script) with `dotenv -e ../.env` if env is required.
- Current `yarn test` in `mini-app` executes `src/test.ts` for ad‑hoc checks.
- Mock external services (Redis/MinIO/Postgres) in unit tests; avoid network I/O.

## Commit & Pull Request Guidelines
- Commits: imperative and scoped, e.g., `mini-app: fix socket auth` or `telegram-bot: add rate limit`.
- PRs: include purpose, linked issues, run instructions, and screenshots for UI. Ensure `docker compose --profile full up -d` and linters pass locally.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets. Validate envs via `devops/CheckoutEnv.sh`.
- Local domains/ports come from `.env` and Compose; see `hosts.txt` for host entries.
