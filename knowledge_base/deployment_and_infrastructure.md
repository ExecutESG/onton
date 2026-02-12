# Onton Platform: Deployment & Infrastructure

This document details the live environment, deployment procedures, and maintenance mechanisms for the Onton platform (`ontonbot`).

## 1. Environments

### Production Server
- **Host IP**: `65.109.212.86`
- **User**: `root`
- **Application Path**: `/root/ontonbot`
- **Orchestration**: Docker Compose
    - **Live Profile**: `full` (launched via `docker compose --profile full up -d`)
    - **Alternate Config**: `docker-compose-server.yml` (production-optimized profile).

### Staging / Local Setup
The platform is designed to be fully reproducible locally or on a staging server.
- **Orchestration**: `docker compose --profile full up -d`
- **Networking**: Relies on `hosts.txt` mappings to `127.0.0.1` and `.env` configuration for `NETWORK_PUBLIC_IP`.

## 2. Deployment Workflow

The standard deployment process for the live server is as follows:

1.  **Code Update**: SSH into the server and perform a `git pull origin main`.
2.  **Environment Check**: Verify `.env` matches the required production state (`ENV=production`).
3.  **Service Rebuild**:
    - To update a specific service: `docker compose --profile full up -d --build <service_name>`
    - To update everything: `docker compose --profile full up -d --build`

## 3. Maintenance Mechanisms

Monitoring and maintenance are performed using a suite of Python-based diagnostic scripts.

### SSH Automation Pattern
Many maintenance scripts (located in `ONTON2026/Misc/Scripts` and `ontonbot/devops/`) utilize the `pty` module to handle SSH connections that require password authentication. 

**Working Verification & Execution Pattern:**
To reliably automate SSH with password-only access, use a `pty` reading loop with `select`:

```python
import pty
import os
import select

def execute_remote(host, password, commands):
    pid, fd = pty.fork()
    if pid == 0:
        # Use StrictHostKeyChecking=no and UserKnownHostsFile=/dev/null for non-interactive logins
        os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{host}"])
    else:
        # Loop reading from fd until prompts appear
        # 1. Detect "password:" -> send password
        # 2. Detect "#" or "~" or "$" -> send commands
        # Use select.select([fd], [], [], timeout) for non-blocking reads
```
- **Robust Prompt Detection**: Look for `#` or `~` to ensure the shell is fully loaded before sending complex command strings.
- **Buffer Management**: Reset or clear the reading buffer after successfully sending the password to avoid double-matching sub-strings.
- **Environment Parity**: Explicitly set `export TERM=xterm` in the remote command string to ensure consistent behavior of terminal-aware tools (e.g., `docker exec`).
- **Precision Container Selection**: When using `docker exec` in scripts, avoid generic names like `postgres`. Use precise filters like `name=${ENV}-postgres` or `docker ps -q -f name=-postgres | head -n 1` to avoid accidentally targeting related containers like `pgadmin`.
- **Redirecting Output**: When piping `docker exec` output to a file (e.g., a DB dump), **avoid the `-t` (TTY) flag**. Using `-t` can inject carriage returns (`\r`) or other TTY control characters into the stream, leading to corrupted or "empty" files (often ~120-130 bytes containing only the gzip header).
- **Common Script Prefix**: `ssh_check_*.py`, `ssh_fix_*.py`, `verify_connections.py`, `migrate_phase2_*.py`.

### SSH Key Authentication (Implemented Feb 2026)
While Python/pty automation handles password entry, **SSH Keys** are the established method for secure, direct terminal access for the agent.
1.  **Key Pair**: `~/.ssh/onton_prod_key` (ED25519).
2.  **Server Installation**: The public key is installed in `/root/.ssh/authorized_keys` on Production.
3.  **Usage**: Enables direct execution without password logic: `ssh -i ~/.ssh/onton_prod_key root@65.109.212.86 "command"`.

## 4. Data Resilience & Backups

The platform uses an automated backup system to ensure data persistence and allow for rapid disaster recovery.

### Backup Architecture
- **Location**: `ontonbot/devops/backup_scripts/`
- **Primary Storage**: Hetzner Storage Box.
- **Isolation Pattern**: Backups are stored in dedicated subdirectories to avoid conflicts:
    - Database: `/backups/ontonbot/database/`
    - Files: `/backups/ontonbot/files/`
- **Backup Scope & Frequency**:
    - **Databases**: Daily `pg_dumpall` (at 03:00 AM) compressed via gzip.
    - **System Files**: Weekly compression of the `./data` directory (Sundays at 04:00 AM), which includes MinIO data, Caddy configs, and application volumes.
- **Consistency vs. Availability**: 
    - **Hot Backups** (Default for automated daily jobs and Dev clones) run while services are active to ensure 100% uptime.
    - **Cold Backups** (Recommended for major migrations or disaster recovery) involve stopping `worker` and `consumer` services briefly to ensure transaction-perfect database and file alignment.
- **Retention**: Local and remote rotation maintaining the last 7 days of daily backups.

### Restoration Procedure
The `restore_from_hetzner.sh` script provides an interactive wizard:
1.  **Selection**: Lists available backups on the Storage Box by date.
2.  **Retrieval**: Downloads selected SQL dumps and data tarballs.
3.  **Deployment**: Automates the service teardown, `psql` import, and file unpacking.

---

## 5. Development & Local Testing

For local development and testing of the integrated ecosystem, a specialized host configuration is used.

### Local Host Mappings (`hosts.txt`)
The platform utilizes several subdomains under `toncloud.observer` which are mapped to `127.0.0.1` for local orchestration:
- `telegram-bot`
- `mini-app.local`
- `app.toncloud.observer`
- `storage.toncloud.observer`
- `metabase.toncloud.observer`
- `monitoring.toncloud.observer`
- `socket.toncloud.observer`
- `pgadmin.toncloud.observer`

These mappings ensure that the various microservices (Mini-App, Bot, Storage, Database, Monitoring) can communicate using standard URLs while running locally.

## 6. Known Issues & Troubleshooting

### SSH Connectivity (Resolved Feb 2026)
Initially, connection attempts to the live server (`65.109.212.86`) using `pty`-based scripts experienced intermittent timeouts. 
- **Resolution**: Verified working scripts (e.g., `verify_connections.py`) that include specific SSH options (`StrictHostKeyChecking=no`), robust `pty` reading loops, and **extended timeouts (300-600s)** for long-running operations like `tar` successfully establish sessions.

### Empty or Header-Only DB Dumps (~126-131 bytes)
When automating `pg_dumpall` via `docker exec`, the resulting file may be suspiciously small (126 bytes for gzipped empty data, or 131 bytes for an uncompressed file containing only the Postgres header).
- **Cause**: 
    1. **Incorrect DB Role**: Using the wrong user (e.g., `onton` instead of `ontonont`).
    2. **TTY Interference**: The `-t` flag in `docker exec` interferes with standard output redirection, injecting control characters or buffering incorrectly.
    3. **Permission/Data Visibility**: The user connects successfully but has no permissions to view or dump specific databases, resulting in a dump containing only the global header (`-- PostgreSQL database cluster dump`).
- **Fix**: 
    1. Verify the correct user in the production `.env` file (Confirmed production user: `ontonont`).
    2. Remove the `-t` flag: `docker exec $PG_CONTAINER pg_dumpall ... > output.sql`.
    3. **Two-Step Diagnostic**: Redirect stdout and stderr separately to isolate the failure: `docker exec $PG_CONTAINER pg_dumpall ... > raw.sql 2> error.log`.
- **Success Metric**: A valid, non-empty database dump for the Onton platform (Feb 2026) is approximately **2.6GB** (gzipped). Anything under 1MB should be treated as a failure.

### OCI Runtime Exec failed: Executable not found
When using `PG_CONTAINER=$(docker ps -q ...)`, if multiple containers are matched, the variable will contain multiple IDs separated by spaces/newlines.
- **Symptom**: `OCI runtime exec failed: ... exec: "0844a1ea70dd": executable file not found in $PATH`. This happens because `docker exec ID1 ID2 command` treats `ID2` as the command to run.
- **Fix**: Use `head -n 1` and status filters: `PG_CONTAINER=$(docker ps -q -f name=postgres -f status=running | head -n 1)`.

### SSL/Caddy (HTTP 403/429)
If the site becomes unreachable via HTTPS:
- **Cause**: Cloudflare API Token IP restriction or rate limiting.
- **Fix**: Check Cloudflare Dashboard and ensure the server IP (`65.109.212.86`) is whitelisted for the "Edit zone DNS" token.

## 7. CI/CD & Secret Management

The platform utilizes GitHub Actions (`build-push-deploy.yml`) for automated deployment across `main`, `staging`, and `dev` branches.

### Branch-Prefixed Secrets
Secrets in GitHub are prefixed by environment (e.g., `MAIN_`, `STAGING_`, `DEV_`). The CI/CD pipeline dynamically extracts these based on the active branch:
- **Process**: The workflow converts all secrets with the matching prefix (e.g., `MAIN_POSTGRES_PASSWORD`) into a standard `.env` file (e.g., `POSTGRES_PASSWORD`) on the target server.
- **Registry**: Docker images are pushed to the GitHub Container Registry (`ghcr.io/pomegroup/ontonbot`).

### Infrastructure Control Secrets
Key secrets required for full environment control:
- **SSH**: `SSH_PRIVATE_KEY` and branch-specific IPs/Ports (e.g., `SSH_MAIN_IP`).
- **Domain/SSL**: `MAIN_CLOUDFLARE_API_TOKEN` and Zone IDs.
- **Deployment Notification**: `TELEGRAM_BOT_TOKEN_FOR_DEPLOYMENT` and `TELEGRAM_CHAT_ID_FOR_DEPLOYMENT`.
