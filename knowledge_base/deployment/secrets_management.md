# Secrets Management & Deployment Configuration

This document serves as the **Master Source of Truth** for managing deployment secrets and environment variables in the Onton platform. It is designed to ensure consistency between Development (Shadow) and Production environments.

## Repository Secrets Strategy
We use GitHub Repository Secrets to inject sensitive configuration into the CI/CD pipeline. The pipeline (`build-push-deploy.yml`) reads these secrets and generates the `.env` file on the target server.

> **Naming Convention**:
> - `DEV_*`: Secrets applied to the `dev` branch deployment.
> - `PROD_*` (Future): Secrets applied to the `main` branch deployment.
> - `STAGING_*` (Future): Secrets applied to the `staging` branch deployment.

## Master Secret Checklist (Development / Shadow)

### 1. Critical Infrastructure (Database & Redis)
| Secret Name | Value | Purpose |
| :--- | :--- | :--- |
| **`DEV_DATABASE_URL`** | `postgres://onton:<PASSWORD>@postgres:5432/mini-app` | **Internal Connection**: Must use `postgres` hostname and internal port `5432`. Used by services inside the Docker Swarm. |
| **`DEV_POSTGRES_PORT`** | `3008` | **External Access**: Maps the internal port 5432 to host port 3008 for DBeaver/PgAdmin access. |
| **`DEV_REDIS_PORT`** | `6379` | **Internal Port**: Standard Redis port used by services. |
| **`DEV_REDIS_URL`** | `redis://redis:6379` | Internal connection string. |
| **`DEV_POSTGRES_DB`** | `mini-app` | The actual database name. |

### 2. Application Configuration & Ports
| Secret Name | Typical Value | Description |
| :--- | :--- | :--- |
| `DEV_MINI_APP_PORT` | `3002` | Host port mapping for Mini App. |
| `DEV_PARTICIPANT_TMA_PORT` | `3001` | Host port for Participant TMA. |
| `DEV_SOCKET_PORT` | `3022` | Host port for Notification Socket. |
| `DEV_PORT_WEB_SITE` | `3003` | Host port for Website. |
| `DEV_TELEGRAM_BOT_PORT` | `3005` | Host port for Telegram Bot. |
| `DEV_DOMAIN` | `dev.onton.live` | Main domain. |
| `DEV_MINI_APP_DOMAIN` | `dev.onton.live` | Mini App domain. |
| `DEV_NEXT_PUBLIC_APP_BASE_URL`| `https://app.dev.onton.live` | Frontend Base URL. |

### 3. External API Tokens
| Secret Name | Services Used By | Description |
| :--- | :--- | :--- |
| `DEV_TELEGRAM_BOT_TOKEN` | Bot, Mini-App | The Bot Token (e.g., from BotFather). |
| `DEV_ONTON_API_KEY` | Server, Clients | API Key for internal/external Auth. |
| `DEV_ONTON_API_SECRET` | Server | Secret for signing requests. |
| `DEV_CLOUDFLARE_API_TOKEN` | Caddy | For SSL Certificate management. |

## CLI Management (gh)
To update secrets programmatically, use the GitHub CLI:

```bash
# Example: Updating Database URL
gh secret set DEV_DATABASE_URL --body "postgres://onton:password@postgres:5432/mini-app"

# Example: Updating Redis Port
gh secret set DEV_REDIS_PORT --body "6379"
```

## Production Expansion Guide
To replicate this setup for production:
1.  Prefix all secrets with `PROD_` instead of `DEV_`.
2.  Ensure `PROD_DATABASE_URL` points to the production database (likely a managed instance or specific production container).
3.  Update the `build-push-deploy.yml` workflow to inject `PROD_` variables when deploying to `main`.
