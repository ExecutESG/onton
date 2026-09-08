# Onton Platform: Migration & Environment Syncing

This document outlines the procedure for duplicating the Production environment state to a new server (e.g., a dedicated Dev server or a backup node).

## 1. Prerequisites

### Target Server Requirements
- **OS**: Linux (Ubuntu 22.04+ recommended).
- **Tooling**: Docker, Docker Compose, `git`, `tar`, `psql` (client).
- **Network**: SSH access (root) and required ports open (80, 443, etc.).

## 2. Migration Procedure (Prod to Dev)

### Phase 1: Production Snapshot
During this phase, you must choose between **Data Consistency** and **Service Availability**.

#### Option A: Cold Backup (Preferred for Production Recovery)
Temporarily stop services to ensure no writes occur during the backup.
1.  **Stop Ingestors**: `docker compose stop event-consumer worker`
2.  **Database Dump**: `docker exec $(docker ps -q -f name=-postgres | head -n 1) pg_dumpall -c -U ontonont > production_full_dump.sql`
3.  **Archive Data Files**: `tar -czvf onton_data_snapshot.tar.gz ./data`

#### Option B: Hot Backup (Preferred for Dev Clones)
Create a snapshot while the system is live. No downtime, but tiny risk of inconsistent files (e.g., a profile picture uploaded during the `tar` operation might be partially corrupted in the backup).
1.  **Database Dump**: `docker exec $(docker ps -q -f name=-postgres | head -n 1) pg_dumpall -c -U ontonont > production_full_dump.sql` (Postgres handles concurrent dumps safely).
2.  **Archive Data Files**: `tar -czvf onton_data_snapshot.tar.gz ./data`

### Phase 2: Codebase Transfer
1.  **Repo Cloning**: Clone the repository on the target server:
    - `git clone https://github.com/pomegroup/ontonbot.git /root/ontonbot`
2.  **Configuration**: Copy the `.env` file from Prod to Dev.
    - **Note**: You must eventually rotate these secrets to ensure environment isolation (see [Project Ownership & Recovery](./project_ownership_and_recovery.md)).

### Phase 3: Data Transfer
1.  **Transfer Artifacts**: Use `scp` or `rsync` to move the snapshot files:
    - `scp production_full_dump.sql onton_data_snapshot.tar.gz root@<TARGET_IP>:/tmp/`

### Phase 4: Target Restoration
1.  **Data Unpacking**:
    - `tar -xzvf /tmp/onton_data_snapshot.tar.gz -C /root/ontonbot/`
2.  **Start Infra**: Bring up the core infrastructure:
    - `docker compose --profile full up -d postgres redis minio`
3.  **Database Import**:
    - `cat /tmp/production_full_dump.sql | docker exec -i postgres psql -U ontonont`
4.  **Full Launch**:
    - `docker compose --profile full up -d`

## 3. Environment Verification
After migration, verify the following:
- **UI**: Access the Mini-App/Landing page via the target IP or temporary DNS.
- **Data**: Check for latest events and user profiles in the DB.
- **Storage**: Verify images/assets are loading from the restored MinIO volume.
- **Bot**: Test interaction with the Telegram bot (if API tokens were updated).

## 4. Troubleshooting
- **Docker Compose Profiles**: Ensure the `--profile full` flag is used if the `docker-compose.yml` uses profiles for service isolation.
- **Volume Permissions**: If services fail to start, check `chown -R root:root ./data` on the target server to ensure the container can read the restored files.
- **Container Networking**: Verify that `NETWORK_PUBLIC_IP` in `.env` is updated to the target server's IP if it's used for site-to-site communication.
- **Automated Snapshots**: For repeated syncs, Phase 1 can be automated using a Python script with `pty` (see the SSH Automation Pattern in [Deployment & Infrastructure](./deployment_and_infrastructure.md)). This allows dumping and bundling in a single non-interactive task.
