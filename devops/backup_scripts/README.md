# ONTON Production Backup & Disaster Recovery Suite

Automated PostgreSQL database snapshot and disaster recovery system for ONTON 2.0 infrastructure, backing up off-site to Hetzner Storage Box.

---

## Features

- **Automated Daily & Weekly Crons**: Daily database dump at 02:00 UTC; weekly full snapshot (DB + `./data`) on Sunday at 03:00 UTC.
- **Dynamic Container Discovery**: Automatically detects `local-onton-postgres`, `${ENV}-postgres`, or running PostgreSQL instances without hardcoding.
- **Off-Site SFTP Storage**: Secure transfer to Hetzner Storage Box using `lftp`.
- **Intelligent Retention Pruning**:
  - **7 Daily** snapshots (Days 0–7)
  - **4 Weekly** snapshots (Days 8–35)
  - **3 Monthly** snapshots (Days 36–90)
  - Prunes expired snapshots beyond 90 days.
- **Instant Telegram Telemetry**: Alerts the admin/deployment topic on backup success or failure with execution duration and file size.
- **Disaster Recovery**: Interactive wizard and non-interactive `--latest` rollback commands.

---

## Required Environment Variables

Set the following variables in your root `.env` file:

```bash
# Hetzner Storage Box Configuration
HETZNER_STORAGE_USER=u434100
HETZNER_STORAGE_PASS="<storage-box-password>"
HETZNER_STORAGE_HOST=u434100.your-storagebox.de
HETZNER_STORAGE_PORT=22
HETZNER_REMOTE_ROOT=/backups/ontonbot

# PostgreSQL Configuration
POSTGRES_USER=ontonont
POSTGRES_PASSWORD="<db-password>"

# Optional Telegram Telemetry
BACKUP_TELEGRAM_BOT_TOKEN="<bot-token>"       # Defaults to BOT_TOKEN
BACKUP_TELEGRAM_CHAT_ID="-1002264975789"       # Defaults to LOGS_GROUP_ID
BACKUP_TELEGRAM_THREAD_ID="<topic-thread-id>"  # Defaults to LOGS_THREAD_ID

# Optional AES-256 Symmetric Snapshot Encryption
# BACKUP_ENCRYPTION_KEY="<strong-secret-key>"
```

---

## Quick Start

### 1. Install Automated Crontab & Logrotate (on Host)
```bash
sudo ./install_cron.sh
```

### 2. Manual Backup Execution
```bash
# Database only (standard daily snapshot)
./backup_to_hetzner.sh db-only

# Full backup (database + data directory)
./backup_to_hetzner.sh full
```

### 3. Restore Snapshot
```bash
# Interactive selection wizard
./restore_from_hetzner.sh

# Fast non-interactive restore of latest snapshot
./restore_from_hetzner.sh --latest

# Dry-run verification (no data modified)
./restore_from_hetzner.sh --latest --dry-run
```

---

## Documentation

For full step-by-step point-in-time recovery and bare-metal server disaster procedures, consult the **[Disaster Recovery Runbook](DISASTER_RECOVERY.md)**.
