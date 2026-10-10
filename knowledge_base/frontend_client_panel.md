# Client Web Panel

> Last verified against dev: 2026-10-03

`client-web-panel/` is a legacy organizer panel. It runs only in local Docker Compose (profile `full`). It is **not** in `docker-compose-server.yml` or `docker-compose-server-dev.yml`, so it is not deployed to staging by CI. The only recent change on dev is a pnpm pin; there are no feature commits.

## 1. Stack

| Item | Value |
|---|---|
| Package | `admash` 1.6.0 (`client-web-panel/package.json`) |
| Language | JavaScript (not TypeScript) |
| Framework | Next.js, Pages Router |
| UI | MUI |
| Data | Redux Toolkit Query |
| i18n | `next-translate` |

## 2. Pages (`client-web-panel/pages/`)

| Page | Purpose |
|---|---|
| `index` | Login (OTP code) |
| `dashboard` | Organizer dashboard |
| `event-management/[uuid]` | Guest list for an event |
| `logout` | Logout |
| `404` | Not found |

There is no event creation wizard, ticket tier editor, media upload or revenue analytics in this app. Event creation lives in `mini-app`.

## 3. API usage

All calls are REST via RTK Query to `NEXT_PUBLIC_BACKEND_URL_CLIENT`. tRPC is not used.

| Slice | Endpoints |
|---|---|
| `redux/slices/authApiSlice.js` | OTP login: send code, login (organizer ID / user ID / login code), logout |
| `redux/slices/ticketApiSlice.js` | `protected/checkin` |
| `redux/slices/usersApiSlice.js` | admin / users endpoints |

## 4. Run locally

- `cd client-web-panel && yarn dev` (port `PORT_CLIENT_WEB`).
- Or `docker compose --profile full up -d`.
- Lint: `yarn lint`.
