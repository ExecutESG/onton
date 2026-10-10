# Project Ownership & Disaster Recovery

> Last verified against dev: 2026-10-03

What you must control to own ONTON, how to rotate secrets, and how to rebuild production.

## 1. Secret domains

Secrets live in two places:
- **GitHub Actions** secrets/vars, prefixed `DEV_`, `MAIN_`, `STAGING_` (used by CI for the staging host).
- **Production `.env`** at `/root/ontonbot/.env` on `65.109.212.86`. Production is deployed by hand, so this file is edited directly on the server.

Names below are env var names (without prefix). Never write values into the repo.

### Infrastructure & deployment
| Secret | Purpose | Rotate |
| :--- | :--- | :--- |
| `SSH_PRIVATE_KEY`, `SSH_{DEV,MAIN,STAGING}_{IP,PORT}` | CI SSH access | New keypair → server `authorized_keys` → GitHub secret |
| `CR_PAT` | GHCR push/pull (`ghcr.io/executesg/onton/*`) | New PAT with `read:packages`, `write:packages` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EMAIL`, `DNS_ZONE_ID` | DNS / ACME | New token with "Edit zone DNS" |
| `TELEGRAM_BOT_TOKEN_FOR_DEPLOYMENT`, `TELEGRAM_CHAT_ID_FOR_DEPLOYMENT` | Deploy notifications | @BotFather |

### Application
| Secret | Purpose |
| :--- | :--- |
| `BOT_TOKEN` | Bot identity; also validates Telegram initData. Rotate via @BotFather. |
| `AUTH_JWT_SECRET` | Platform JWT signing |
| `ONTON_API_SECRET`, `ONTON_API_KEY` | Server-to-server API key; upload JWTs |
| `BOT_API_HMAC_SECRET` | HMAC between mini-app and bot |
| `TOTP_SECRET` | Rotating ticket pass tokens |
| `CLIENT_API_JWT_SECRET` | Client API |
| OAuth `GOOGLE_`/`TWITTER_`/`GITHUB_`/`LINKEDIN_`/`MS_` `CLIENT_ID` + `CLIENT_SECRET` | Social login / linking |
| `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `MB_ENCRYPTION_SECRET_KEY` | pgAdmin, Metabase |

> [!WARNING]
> Several of these secrets have insecure fallbacks in code if unset. Set every one of them in every environment. Rotating `AUTH_JWT_SECRET` / `ONTON_API_SECRET` / `BOT_TOKEN` logs users out.

### Blockchain
| Secret | Purpose |
| :--- | :--- |
| `MNEMONIC` | Wallet that signs mints |
| `EVENT_WALLET_ENC_KEY` | Encrypts per-event wallets. Losing it loses access to those wallets. |
| `TON_CENTER_TOKEN`, `TON_CENTER_ENDPOINT` | TonCenter API |

### Storage & database
| Secret | Purpose |
| :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` | Postgres |
| `POSTGRES_MINI_APP_DB` (+ `POSTGRES_NFT_MANAGER_DB`, `POSTGRES_METABASE_DB`) | DB names |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | MinIO |
| `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS` | RabbitMQ |
| `REDIS_PASSWORD` | Redis (optional) |

---

## 2. Total reset procedure (production)

### Step 1: Back up first
- Take a manual dump ([manual_db_maintenance.md](./manual_db_maintenance.md)) and archive `./data`. There are no automated backups.

### Step 2: Rotate secrets
1. Update GitHub secrets/vars.
2. Update `/root/ontonbot/.env` on production.
3. Rotate SSH keys on both hosts.

### Step 3: Rebuild
1. On `65.109.212.86` in `/root/ontonbot`: `git pull`.
2. `docker compose --profile full up -d --build`.

GitHub Actions does **not** rebuild production. Pushing `main` or editing `Trigger-full-build.txt` only redeploys the staging host.

> [!CAUTION]
> `docker compose down -v` and `docker system prune -a --volumes` delete named volumes (`pgadmin`, `clamav_data`, `rabbitmq_data`). Postgres data is a bind-mount at `./data/db_data`; deleting `./data` deletes the database. Only do this with a verified dump in hand.

### Step 4: Restore data
- Import the SQL dump with `psql` and unpack `./data` (see Phase 4 in [migration_and_syncing.md](./migration_and_syncing.md)).
- `devops/backup_scripts/restore_from_hetzner.sh` exists for restoring from a Hetzner Storage Box, but only works if backups were actually uploaded there by hand or by a manually installed cron.

### Step 5: Verify
- HTTPS works on `app.onton.live`.
- `@theontonbot` responds (production only; never test against it from non-prod).
- Images load from MinIO.

---

## 3. Observability
- Deploy notifications: the Telegram chat in `TELEGRAM_CHAT_ID_FOR_DEPLOYMENT` (CI deploys only).
- Production logs: `docker compose --profile full logs -f --tail 100` in `/root/ontonbot`.
- Staging logs: `docker service logs onton-dev_<service> -f`.

## Known issues (tracked in QA)
- No automated prod DB backups.
- F-04: no automated prod deploy; CI deploys `main` to the staging host.
- F-30: PoA has a universal override; slated for removal.
