# Ontonbot Technical Onboarding Guide

## 1. Project Overview
**Ontonbot** is a comprehensive event management platform built as a monorepo. It leverages a microservices-like architecture orchestrated via Docker Compose, with a heavy focus on Next.js for frontend applications and standard backend services (Postgres, Redis, RabbitMQ).

### Core Technologies
-   **Frontend/App**: Next.js (React), Telegram Mini Apps (TMA)
-   **Backend Services**: Postgres (Database), Redis (Cache), RabbitMQ (Queues)
-   **Infrastructure**: Docker, Docker Compose, Caddy (Reverse Proxy)
-   **Package Manager**: `yarn` / `pnpm` (depending on the specific service)

## 2. Prerequisites
Before starting, ensure you have the following installed:
-   **Docker Desktop** (latest stable version)
-   **Node.js** (v18 or v20 recommended)
-   **Git**

## 3. Project Structure
The repository is organized as a monorepo:

```
ontonbot/
├── newton/                 # Next.js Applications Monorepo
│   └── apps/
│       ├── participant-tma # Main Telegram Mini App for participants
│       └── ...
├── mini-app/               # Main Mini App Service (Node.js/Next.js)
├── website/                # Public Landing Page/Website
├── client-web-panel/       # Client Web Dashboard
├── devops/                 # Infrastructure configuration (Caddy, Certs)
├── swagger/                # API Documentation
├── docker-compose.yml      # Local development orchestration
├── docker-compose-server.yml # Production orchestration profile
└── params/                 # Parameter configuration files
```

## 4. Local Development Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/PomeGroup/ontonbot.git
cd ontonbot
```

### Step 2: Configure Environment
Copy the example environment file and configure it:
```bash
cp .env.example .env
```
> **Critical**: Ensure `NETWORK_PUBLIC_IP` is set correctly. For local dev, internal Docker IPs usually suffice, but for production, this must match the server IP.

### Step 3: Start Services
Use Docker Compose to spin up the entire stack:
```bash
# Start all services
docker compose --profile full up -d

# Check status
docker compose --profile full ps
```

### Step 4: Access Applications
By default (check `.env` for overrides), services run on:
-   **Mini App**: `http://localhost:3000`
-   **Participant TMA**: `http://localhost:3001`
-   **Client Web**: `http://localhost:3002`
-   **Website**: `http://localhost:3003`

## 5. Production Deployment
**Server IP**: `65.109.212.86`
**User**: `root`

### Deployment Workflow
1.  **SSH into Server**:
    ```bash
    ssh root@65.109.212.86
    cd ontonbot
    ```

2.  **Update Code**:
    ```bash
    git pull origin <branch_name>
    ```

3.  **Update Environment (if needed)**:
    -   Edit `.env` to update `IPV4` addresses or Keys.
    -   **Important**: Ensure `ENV=production` is set.

4.  **Rebuild & Restart**:
    ```bash
    # Rebuild specific services without cache if code changed
    docker compose --profile full up -d --build <service_name>
    
    # Or restart everything
    docker compose --profile full up -d --build
    ```

### Troubleshooting Common Issues

#### 1. SSL/Caddy Issues (`HTTP 429` or `403`)
-   **Symptom**: Site is unreachable via HTTPS. Log shows `HTTP 403` or `429`.
-   **Cause**: Cloudflare API Token IP restriction or Rate Limiting.
-   **Fix**: 
    -   Check Cloudflare Dashboard > API Tokens > "Edit zone DNS" token.
    -   Ensure Server IP (`65.109.212.86`) is whitelisted.
    -   If Rate Limited (429), wait 1 hour for cooldown.

#### 2. Build Failures (Env Vars)
-   **Symptom**: `participant-tma` or `mini-app` fails during `docker build`.
-   **Cause**: Next.js builds often require `NEXT_PUBLIC_` variables to be present at build time.
-   **Fix**: Ensure your `.env` contains valid placeholders for `BOT_TOKEN` or `NEXT_PUBLIC_BOT_USERNAME` if real values aren't strictly required for the build itself.

#### 3. Database Restoration
-   **Backup Path**: `ontonbot/data/db_data`
-   To restore from a raw data directory backup:
    1.  Stop Postgres: `docker compose stop postgres`
    2.  Replace contents of `data/db_data` with backup.
    3.  Start Postgres: `docker compose up -d postgres`
