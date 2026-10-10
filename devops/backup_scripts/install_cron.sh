#!/usr/bin/env bash

# ==============================================================================
# ONTON Backup Cron & Logrotate Installer
# ==============================================================================
# Configures automated daily and weekly backup crons on the host machine
# (targeting 65.109.212.86) and provisions logrotate rules to manage logs.
#
# Schedule:
#   • Daily DB Backup:   02:00 UTC every day (db-only)
#   • Weekly Full Backup: 03:00 UTC every Sunday (full)
#
# Usage:
#   sudo ./install_cron.sh [--uninstall] [--status]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup_to_hetzner.sh"
LOG_FILE="/var/log/onton_backup.log"
CRON_TAG="# ONTON-AUTOMATED-BACKUP-CRON"

# Require root for crontab and logrotate setup
if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Error: This script must be run as root (or with sudo)."
  exit 1
fi

ACTION="${1:-install}"

case "$ACTION" in
  --uninstall|uninstall)
    echo "--> Removing ONTON backup cron jobs..."
    crontab -l 2>/dev/null | grep -v "$CRON_TAG" | grep -v "backup_to_hetzner.sh" | crontab - || true
    rm -f /etc/logrotate.d/onton-backup
    echo "✅ ONTON backup cron uninstalled."
    exit 0
    ;;
  --status|status)
    echo "=== Active Crontab ==="
    crontab -l 2>/dev/null || echo "No crontab installed."
    echo ""
    echo "=== Backup Log (/var/log/onton_backup.log) ==="
    if [ -f "$LOG_FILE" ]; then
      tail -n 20 "$LOG_FILE"
    else
      echo "No log file found at $LOG_FILE"
    fi
    exit 0
    ;;
esac

echo "=========================================="
echo "    ONTON BACKUP CRON INSTALLER          "
echo "=========================================="

# 1. Validate prerequisites
echo "--> Checking prerequisites..."
MISSING_PKGS=()
for cmd in docker lftp gzip curl python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    MISSING_PKGS+=("$cmd")
  fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
  echo "⚠️ Missing prerequisite packages: ${MISSING_PKGS[*]}"
  echo "Attempting to install missing packages via apt..."
  apt-get update -y && apt-get install -y "${MISSING_PKGS[@]}"
fi

# Ensure backup script is executable
chmod +x "$BACKUP_SCRIPT"
chmod +x "${SCRIPT_DIR}/retention_policy.py"
chmod +x "${SCRIPT_DIR}/restore_from_hetzner.sh"

# Touch log file with secure permissions
touch "$LOG_FILE"
chmod 640 "$LOG_FILE"

# 2. Configure Logrotate
echo "--> Provisioning logrotate configuration (/etc/logrotate.d/onton-backup)..."
cat > /etc/logrotate.d/onton-backup <<EOF
$LOG_FILE {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
EOF

# 3. Provision Crontab
echo "--> Updating root crontab..."
CURRENT_CRON=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG" | grep -v "backup_to_hetzner.sh" || true)

CRON_ENTRIES="$CURRENT_CRON
$CRON_TAG - Daily PostgreSQL Database Snapshot at 02:00 UTC
0 2 * * * $BACKUP_SCRIPT db-only >> $LOG_FILE 2>&1
$CRON_TAG - Weekly Full Infrastructure Archive on Sunday at 03:00 UTC
0 3 * * 0 $BACKUP_SCRIPT full >> $LOG_FILE 2>&1"

echo "$CRON_ENTRIES" | crontab -

echo "✅ Crontab successfully updated!"
echo ""
echo "=== Active Backup Cron Jobs ==="
crontab -l | grep -A 1 "$CRON_TAG"
echo "==============================="
echo ""
echo "Automated backups configured:"
echo "  • Daily DB Backup:   02:00 UTC daily (db-only)"
echo "  • Weekly Full:       03:00 UTC Sunday (full)"
echo "  • Logs:              $LOG_FILE"
echo "  • Logrotate:         /etc/logrotate.d/onton-backup"
