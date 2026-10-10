# ONTON 2.0 Production Deployment & Operations Guide

> Last verified against dev: 2026-10-03

## 1. Environments

| Env | Host | Runtime | Deploy method |
|---|---|---|---|
| Production | 65.109.212.86 | Plain `docker compose` project `local-onton` in `/root/ontonbot`, built on the server with `--profile full` | **Manual** |
| Staging | 65.109.182.13 | Docker Swarm stack `onton-dev` (`docker-compose-server-dev.yml`) | CI on push to `dev` |

Bots: production `@theontonbot`, staging `@notnonstagebot`, local `@ontonlocaldevbot`.

- Branches: `dev` = staging / active development, `main` = production source.
- Production is **not** deployed by CI. See section 2.

## 2. CI/CD pipeline (what it actually does)

Workflow: [`.github/workflows/build-push-deploy.yml`](../.github/workflows/build-push-deploy.yml).

| Job | What it does |
|---|---|
| `determine-services` | Maps changed paths to `mini-app`, `telegram-bot`, `website`, `caddy`. `Trigger-full-build.txt` builds all. If nothing matches, it builds `telegram-bot`. |
| `validate-services` | mini-app: `yarn lint:quiet` + `yarn test:api` (Vitest). telegram-bot: `yarn run build` (tsc). Runs on PRs too. |
| `build-and-push` | Push/dispatch only. Builds `--target production`. Pushes `ghcr.io/executesg/onton/<service>` tagged `<branch>-<run_id>` and `<branch>-latest`. All workers reuse the `mini-app` image. |
| `deploy` | SSH to the host in `SSH_DEV_IP`, then `docker stack deploy`. `dev` → stack `onton-dev`; `main` → stack `onton` (`docker-compose-server.yml`). Then a post-deploy Playwright smoke run (`smoke.spec.ts`). |

> [!WARNING]
> Both `dev` and `main` deploy to the **staging host** (F-04). On `main`, the post-deploy smoke test targets `https://app.onton.live` (production) even though nothing was deployed there. A green `main` run does not mean production was updated.

## 3. Manual production deploy

1. Make sure the change is merged to `main` and passed staging.
2. Take a database dump first. There are **no automated production backups**; see [`knowledge_base/manual_db_maintenance.md`](../knowledge_base/manual_db_maintenance.md).
3. On the production host, in `/root/ontonbot`: `git pull origin main`.
4. Apply any new SQL migrations by hand, in order:
   `psql -v ON_ERROR_STOP=1 -f mini-app/drizzle/<file>.sql`
   **Never run `yarn db:migrate`** — the Drizzle journal is stale. The Docker images do not run migrations.
5. Rebuild and restart: `docker compose --profile full up -d --build`.
6. Verify (section 5).

## 4. Pre-flight configuration

### Telegram Stars
- The bot creates Stars invoices with currency `XTR` (`telegram-bot/src/controllers/starsInvoiceHandler.ts`). Check that payments work for the production bot in `@BotFather`.

### Event group invite links
- The bot sends single-use invite links (`member_limit: 1`) to approved/checked-in registrants (`telegram-bot/src/controllers/createInviteLinkHandler.ts`, `mini-app/src/cronJobs/tasks/generateInviteLinksCron.ts`).
- The bot must be an admin of the event group with permission to create invite links.
- There is no join-request verification or removal of non-holders; only invite links.

### Secrets
- Set `AUTH_JWT_SECRET`, `TOTP_SECRET`, `ONTON_API_SECRET`, `BOT_API_HMAC_SECRET` and `MNEMONIC` in the production `.env`. Code falls back to weaker values when some of these are unset.

## 5. Post-deploy verification

Read-only smoke test (safe against production):

```bash
cd tests/e2e
BASE_URL=https://app.onton.live npx playwright test smoke.spec.ts
```

Manual checks (do not create test payments or mutations on `@theontonbot`):

| Step | Check | Expected |
|---|---|---|
| 1 | Open the mini-app from `@theontonbot` | Home and event pages load |
| 2 | Open a ticket pass | QR code rotates (pass token refreshes about every 12s) |
| 3 | Organizer opens the check-in scanner | Live pass resolves; a static UUID is rejected |
| 4 | `docker compose ps` on the host | All `full` services are up |

## 6. Rollback

- There is no automatic rollback for production (it is plain compose, not Swarm).
- Roll back by checking out the previous good commit in `/root/ontonbot` and running `docker compose --profile full up -d --build` again.
- SQL migrations are not reversed automatically. Restore from the dump taken in step 3.2 if a migration must be undone.

## Known issues (tracked in QA)
- CI deploys `main` to the staging host; no automated production deploy (F-04).
- No automated production DB backups.
- Telegram Stars pre-checkout is approved without order/price/capacity validation (F-33).
- `order_paid` queue consumer likely fails; the 9s mint cron is the real fulfillment path (F-35).
