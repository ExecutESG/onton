# Backup & Restoration Scripts

This directory contains utility scripts for backing up the ONTON infrastructure to a Hetzner Storage Box.

## Prerequisites
- **lftp**: Must be installed on the host machine (`apt install lftp`).
- **Docker**: Container `production-postgres` must be running.
- **Environment**: `.env` file must exist in the project root.

## Scripts

### 1. `backup_to_hetzner.sh`
Creates a backup and uploads it.
- **Usage**: `./backup_to_hetzner.sh [full|db-only]`
- **Env Vars**: Uses `HETZNER_STORAGE_USER`, `HETZNER_STORAGE_PASS`, etc. from `.env`.

### 2. `restore_from_hetzner.sh`
Interactive wizard to restore from a backup.
- **Usage**: `./restore_from_hetzner.sh`
- **Warning**: Overwrites existing database and/or data files.

## Automation (Cron Setup)

To enable automatic backups, add the following to the root user's crontab on the production server:

1. Open crontab:
   ```bash
   crontab -e
   ```

2. Add lines (Adjust path to `/root/ontonbot/...`):
   ```bash
   # Daily Database Backup at 03:00 AM
   0 3 * * * /root/ontonbot/devops/backup_scripts/backup_to_hetzner.sh db-only >> /var/log/onton_backup_db.log 2>&1

   # Weekly Full Backup (DB + Files) on Sunday at 04:00 AM
   0 4 * * 0 /root/ontonbot/devops/backup_scripts/backup_to_hetzner.sh full >> /var/log/onton_backup_full.log 2>&1
   ```

3. Verify:
   ```bash
   crontab -l
   ```
