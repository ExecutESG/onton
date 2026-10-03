# Onton Platform: Deployment & Infrastructure

> Last verified against dev: 2026-10-03

Where ONTON runs, how it is deployed, and how data is backed up.

## 1. Environments

| | Production | Staging | Local |
| :--- | :--- | :--- | :--- |
| Host | `65.109.212.86` | `65.109.182.13` | your machine |
| Orchestration | Plain `docker compose`, project `local-onton` | Docker Swarm, stack `onton-dev` | `docker compose` |
| Compose file | `docker-compose.yml` with `--profile full` | `docker-compose-server-dev.yml` | `docker-compose.yml` with a profile |
| App path | `/root/ontonbot` | `/home/tonont/<branch>` (copied by CI) | repo root |
| Deploy | Manual (see §2) | GitHub Actions on push to `dev` | — |
| Bot | `@theontonbot` | `@notnonstagebot` | `@ontonlocaldevbot` |
| Mini App URL | `app.onton.live` | `app.dev.onton.live` | `MINI_APP_PORT` |

Notes:
- The repo is `github.com/ExecutESG/onton`. Images are `ghcr.io/executesg/onton/<service>`.
- `docker-compose-server.yml` is **not** used by production. CI deploys it as Swarm stack `onton` (branch `main`) to the **staging** host. See [deployment_pipeline.md](./deployment_pipeline.md).
- Staging domains come from the root `Caddyfile`: `dev.onton.live` → website, `app.dev.onton.live` → mini-app, `minio.dev.onton.live` / `files.dev.onton.live` → MinIO.
- Staging runs 0 replicas for all workers and the notification socket, and has no RabbitMQ, Metabase, pgAdmin or ClamAV. Worker, socket and queue flows cannot be tested on staging.

### Services in `docker-compose.yml` (profile `full`)
- Proxy: `caddy` (built from `devops/caddy`, image `caddy:latest` + Cloudflare DNS and rate-limit modules).
- Data: `postgres` (16.3, data bind-mounted at `./data/db_data`), `redis` (7.4.1, no persistence), `minio`, `rabbitmq` (4.0.4).
- Apps: `mini-app`, `telegram-bot`, `website`, `client-web`, `metabase`, `pgadmin`, `clamav`, `swagger-ui`.
- Workers (all use the `mini-app` image with a different `command`): `mini-app-sbt-worker` (`start-cron-nft-api`), `mini-app-payment-worker` (`start-cron-payment`), `mini-app-reward-worker`, `mini-app-ordinary-worker`, `mini-app-poa-worker` (`start:poa`), `mini-app-notification-socket` (`start:socket`).
- Container names are `${ENV}-<service>` (e.g. `${ENV}-postgres`).
- `participant-tma` and `mini-app-moderation-bot` are removed. `/ptma` URLs are handled by 4 explicit rewrites in `mini-app/next.config.js`.

> [!NOTE]
> Worker naming differs between files: in `docker-compose.yml` the `sbt-worker` runs the NFT-API scheduler; in both server compose files it runs the payment scheduler.

## 2. Production deployment (manual)

There is no automated production deploy (QA finding F-04).

1. SSH into `65.109.212.86` and go to `/root/ontonbot`.
2. `git pull` the release branch.
3. Check `.env` (`ENV=production`). Set every secret env var; several have insecure fallbacks if unset.
4. Apply any new SQL migrations with `psql -v ON_ERROR_STOP=1` (see [migration_and_syncing.md](./migration_and_syncing.md)). Never run `yarn db:migrate`.
5. Rebuild on the server:
   - One service: `docker compose --profile full up -d --build <service>`
   - Everything: `docker compose --profile full up -d --build`

> [!CAUTION]
> Do not run `docker compose down -v` on production. `-v` deletes the named volumes (`pgadmin`, `clamav_data`, `rabbitmq_data`).

## 3. Backups

**There are no automated production DB backups.** Backups are manual.

- Scripts exist in `devops/backup_scripts/` (`backup_to_hetzner.sh`, `restore_from_hetzner.sh`) and `devops/Backup.sh`.
- `devops/backup_scripts/README.md` describes a crontab to install by hand. It is not installed by any deploy step.
- `./data/db_data` is the live Postgres bind-mount, not a backup.
- Manual dump procedure: [manual_db_maintenance.md](./manual_db_maintenance.md).

### `docker exec` tips for dumps
- Do not use `-t` when redirecting output to a file. A TTY can corrupt the stream and produce a near-empty file.
- Select the container precisely: `docker ps -q -f name=postgres -f status=running | head -n 1`. Without `head -n 1`, several IDs can match (e.g. pgAdmin) and `docker exec` fails with "executable file not found".
- Redirect stdout and stderr separately (`> dump.sql 2> error.log`) to see why a dump is empty.

## 4. CI/CD secrets

Workflow: `.github/workflows/build-push-deploy.yml`.

- Secrets/vars are prefixed by branch: `DEV_`, `MAIN_`, `STAGING_`. The deploy job writes a `.env` from the matching prefix (prefix stripped) and copies it to the server.
- Build args come from `devops/export_env.py build_args "<BRANCH>_"`.
- Other secrets: `SSH_PRIVATE_KEY`, `SSH_{DEV,MAIN,STAGING}_{IP,PORT}`, `CR_PAT`, `TELEGRAM_BOT_TOKEN_FOR_DEPLOYMENT`, `TELEGRAM_CHAT_ID_FOR_DEPLOYMENT`.
- Deploy uses `SSH_DEV_*` for both `dev` and `main`. `SSH_MAIN_IP` is only used by `.github/workflows/inspect-server.yml`.

## 5. Troubleshooting

### SSL / Caddy (HTTP 403/429 from ACME)
- Likely cause: the Cloudflare API token is IP-restricted or rate-limited.
- Fix: in Cloudflare, check the "Edit zone DNS" token allows the server IP.

### Staging Caddyfile
- CI does not copy the `Caddyfile`. It regenerates it with `devops/generate-caddyfile-by-address.sh` only when `caddy` is in the build set.

## Known issues (tracked in QA)
- No automated prod DB backups.
- F-04: CI deploys `main` to the staging host; no automated prod deploy.
- The post-deploy smoke test for `main` targets the prod URL while the deploy went to the staging host, so it is not a real gate.
- `.github/workflows/inspect-server.yml` action `update-prod-dns` points `prod.onton.live` at the staging host.
- The generated `.env` is left on the server after deploy.
