# ONTON Deployment Pipeline Knowledge Base

This document provides a comprehensive analysis of the CI/CD pipeline for the ONTON platform, covering both Dev (Shadow) and Production environments. It explains "how it works" so you can debug and manage deployments independently.

---

## 1. High-Level Architecture

The deployment process is fully automated using **GitHub Actions**, **Docker Buildx**, **GitHub Container Registry (GHCR)**, and **Docker Swarm**.

```mermaid
graph TD
    User([Developer]) -->|Push/Merge| GH[GitHub Repository]
    GH -->|Trigger| Action[GitHub Action Workflow]
    
    subgraph "CI: Build & Push"
        Action -->|Determine Changes| Matrix[Service Matrix]
        Matrix -->|Build Docker Image| Build[Docker Buildx]
        Build -->|Push| GHCR[GHCR Registry]
    end
    
    subgraph "CD: Deployment (SSH)"
        Action -->|SSH Connection| Server[Target Server (Dev/Prod)]
        Server -->|Pull New Images| GHCR
        Server -->|Update Stack| Swarm[Docker Swarm]
        Swarm -->|Rolling Update| Services[Running Containers]
    end
```

---

## 2. The Workflow Explained
File: `.github/workflows/build-push-deploy.yml`

The pipeline consists of three sequential jobs:

### Job 1: `determine-services`
*   **Goal:** Save time by only building what changed.
*   **Mechanism:** It runs `git diff` between previous and current commit.
*   **Logic:** 
    *   If `mini-app/` changes -> Builds `mini-app`, `workers`, `sockets`.
    *   If `devops/` or `docker-compose*.yml` changes -> Rebuilds relevant services.
    *   If `Trigger-full-build.txt` is modified -> **Forces a rebuild of EVERYTHING.** (Use this if caches get weird).
*   **Output:** A JSON list of services to build.

### Job 2: `build-and-push`
*   **Goal:** Create Docker images and store them.
*   **Tagging Strategy:**
    *   `ghcr.io/.../service:branch-commitSHA` (Unique History)
    *   `ghcr.io/.../service:branch-latest` (Mutable Tag for Deployment)
    *   *Example:* `dev-latest` for Shadow, `main-latest` for Production.
*   **Secrets:** It injects build-time variables (starting with `DEV_` or `MAIN_` based on branch) into the image build args.

### Job 3: `deploy`
*   **Goal:** Update the running server.
*   **Environment Selection:**
    *   Branch `dev` -> Uses `SSH_DEV_IP`, `SSH_DEV_PORT`, `docker-compose-server-dev.yml`.
    *   Branch `main` -> Uses `SSH_MAIN_IP`, `SSH_MAIN_PORT`, `docker-compose-server.yml`.
*   **Execution Steps:**
    1.  **SSH into Server.**
    2.  **Copy Files:** `docker-compose` files, `devops/`, `swagger/` are copied fresh every time.
    3.  **Generate `.env`:** A script on the runner generates a `.env` file from GitHub Secrets and copies it to the server.
    4.  **Special Handling (Caddy):** If Caddy changes, it runs a script to regenerate the `Caddyfile` dynamically.
    5.  **Docker Stack Deploy:** updates the stack named `onton`.
    6.  **Force Update:** Explicitly forces a service update (`docker service update --force`) to ensure containers pick up the new `latest` image.

---

## 3. Environment Strategy

The pipeline supports two distinct environments based on the git branch.

| Feature | Dev (Shadow) | Production |
| :--- | :--- | :--- |
| **Branch** | `dev` | `main` |
| **Compose File** | `docker-compose-server-dev.yml` | `docker-compose-server.yml` |
| **Secrets Prefix** | `DEV_` (e.g. `DEV_DATABASE_URL`) | `MAIN_` (e.g. `MAIN_DATABASE_URL`) |
| **Replicas** | 1 (Low Resource) | Scalable (Default 2) |
| **Network** | `onton-shadow-network` | `onton-shadow-network` (Overlay) |
| **Image Tag** | `dev-latest` | `main-latest` |

### Secret Management
*   **GitHub Secrets** are the source of truth.
*   **Mapping:** The workflow automatically maps `DEV_MY_SECRET` -> `MY_SECRET` inside the Dev container.
*   **Implication:** If you add a new env var `API_KEY`, you must add `DEV_API_KEY` and `MAIN_API_KEY` to GitHub Secrets.

---

## 4. Service Breakdown

### Core Services
*   **`mini-app`**: The main Next.js application (client & admin).
*   **`telegram-bot`**: Handles Telegram interactions.
*   **`participant-tma`**: The separate Participant Mini App.
*   **`website`**: The marketing landing page.

### Workers (Background Jobs)
These are specialized instances of the `mini-app` image running specific commands:
*   `mini-app-sbt-worker`: Minting SBTs.
*   `mini-app-reward-worker`: Distributing rewards.
*   `mini-app-poa-worker`: Proof of Action processing.
*   `mini-app-notification-socket`: WebSocket server for real-time updates.

### Infrastructure (Dockerized)
*   **`caddy`**: Reverse Proxy (HTTPS, Routing).
*   **`postgres`**: Database.
*   **`redis`**: Caching & Queues.
*   **`minio`**: S3-compatible Object Storage.
*   **`fluentd` / `elasticsearch` / `kibana`**: Logging stack.

---

## 5. How to Trigger Deployments

### Automated
1.  **Code Change:** Modify any file in `mini-app/` or `devops/`.
2.  **Push:** `git push origin dev` (deploys to Shadow) or `git push origin main` (deploys to Prod).
3.  **Monitor:** Watch the "Actions" tab in GitHub.

### Manual Full Rebuild
If you need to force-rebuild everything (e.g., after changing a secret that is used verify build time):
1.  Edit `Trigger-full-build.txt` (add a space or bump version).
2.  Push.

---

## 6. Troubleshooting Guide

### Issue: "Deployment Passed, but Code Didn't Update"
*   **Cause:** The `latest` tag might be cached on the server, or the service didn't restart.
*   **Fix:** The pipeline runs `docker service update --force`. If that fails, SSH into the server and run:
    ```bash
    docker service update --force onton_mini-app
    ```

### Issue: "Build Failed on GHCR Login"
*   **Cause:** `CR_PAT` (Container Registry Personal Access Token) might be expired or missing in GitHub Secrets.
*   **Fix:** Regenerate a PAT with `read:packages` and `write:packages` scope and update `CR_PAT` secret.

### Issue: "Database Connection Failed"
*   **Cause:** Incorrect `SSH_IP` or `DATABASE_URL` secrets.
*   **Check:** Verify `DEV_DATABASE_URL` in GitHub Secrets matches the actual DB credentials.

### Issue: "Caddy Routing Error (404/502)"
*   **Cause:** The `generate-caddyfile-by-address.sh` script might have failed or generated bad config.
*   **Check:** SSH to server, check `docker service logs onton_caddy`.

### SSH Access (Emergency)
To manually inspect the server:
```bash
ssh -p <PORT> tonont@<IP>
# Then
docker service ls
docker service logs onton_mini-app -f
```
