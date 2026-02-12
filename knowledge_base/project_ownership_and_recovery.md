# Project Ownership & Disaster Recovery

This document outlines the requirements and procedures for taking full control of the Onton Platform and performing a complete environment recovery or repo migration.

## 1. Governance & Secret Management

Taking over the project requires control of four primary secret domains.

### Domain 1: Infrastructure & Deployment
Used by GitHub Actions to build and push code to the production server.
- **SSH Access**: `SSH_PRIVATE_KEY` (Root access). 
    *   *Reset Action*: Generate a new SSH Keypair. Add Public Key to server's `authorized_keys`. Update GitHub Secret.
- **Domain/SSL (Cloudflare)**: `MAIN_CLOUDFLARE_API_TOKEN`.
    *   *Reset Action*: Create a new API Token in Cloudflare dashboard with "DNS Edit" permissions.
- **Registry Access**: `DOCKER_HUB_TOKEN`.
    *   *Reset Action*: Generate a new Access Token in Docker Hub account settings.
- **Local Control Key**: `~/.ssh/onton_prod_key` (ED25519).
    *   *Status*: Verified & Active (Feb 2026). Installed on server.

### Domain 2: Application Secret (Business Logic)
Required for the Mini-App and Bot to function.
- **Bot Identity**: `MAIN_BOT_TOKEN`.
    *   *Reset Action*: Use **@BotFather** on Telegram. Revoke old token and generate a new one.
- **API Security**: `MAIN_ONTON_API_KEY`.
    *   *Reset Action*: Generate a new random 32+ character string. Update GitHub and any internal consumers.
- **Administrative Access**: `MAIN_PGADMIN_DEFAULT_EMAIL`, `MAIN_PGADMIN_DEFAULT_PASSWORD`.
- **Analytics/DB UI**: `MAIN_MB_ENCRYPTION_SECRET_KEY` (Metabase).

### Domain 3: Blockchain & On-Chain Keys
Used for TON network interactions, NFT minting, and social hubs.
- **Network Access**: `MAIN_TONAPI_API_KEY`.
    *   *Reset Action*: Regenerate key in **tonapi.io** dashboard.
- **Project Identity**: `MAIN_TON_SOCIETY_API_KEY`.
- **Wallet Security**: `MAIN_MNEMONIC` (Seed phrase for the treasury/action wallet), `MAIN_EVENT_WALLET_ENC_KEY`.

### Domain 4: Storage & Database
- **Primary Database**: `MAIN_POSTGRES_USER` (Confirmed: `ontonont`), `MAIN_POSTGRES_PASSWORD` (Confirmed: `@GqjCiFjdywo2hliunXyeLBD`).
- **Database Names**: `mini-app`, `nft-manager`.
- **Object Storage (MinIO)**: `MAIN_MINIO_ROOT_USER`, `MAIN_MINIO_ROOT_PASSWORD`.
- **Queue/Cache**: `MAIN_RABBITMQ_DEFAULT_USER`, `MAIN_RABBITMQ_DEFAULT_PASS`, `MAIN_REDIS_PASSWORD`.

---

## 2. "Starting Over" (Total Reset Procedure)

If the production environment is compromised or a fresh start is required, follow this sequence:

### Step 1: Secret Rotation
1. Update all secrets in **GitHub > Settings > Secrets and variables > Actions**.
2. Rotate the `SSH_PRIVATE_KEY` by generating a new one and adding it to the server's `authorized_keys`.
3. Update `.env` files on the server to reflect rotation.

### Step 2: Infrastructure Wipe
1. SSH into the server (`65.109.212.86`).
2. Run `docker compose down -v` to remove all containers and **all volumes** (Warning: This deletes local data).
3. Clear orphan Docker assets: `docker system prune -a --volumes`.

### Step 3: Reconstruction (Code-First)
1. Ensure the repo is up-to-date locally.
2. Trigger a full build and deploy using GitHub Actions (e.g., by updating `Trigger-full-build.txt`).
3. Verify basic connectivity (HTTPS and Bot responsiveness).

### Step 4: Data Restoration
1. Navigate to `devops/backup_scripts/`.
2. Execute `./restore_from_hetzner.sh`.
3. Select the most recent verified backup date.
4. Restore both **Database** and **Files** (MinIO/Config) to bring back users and event assets.

---

## 3. Deployment Observability

To monitor the health of a fresh deployment:
- **Telegram Notifications**: Monitored via `TELEGRAM_CHAT_ID_FOR_DEPLOYMENT`.
- **Live Logs**: `docker compose logs -f --tail 100` on the server.
- **Monitoring URLs**:
    - `monitoring.toncloud.observer` (Infrastructure health)
    - `pgadmin.toncloud.observer` (Database state)
