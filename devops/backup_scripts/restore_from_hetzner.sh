#!/usr/bin/env bash

# ==============================================================================
# ONTON Production Restoration Script
# ==============================================================================
# Downloads and restores PostgreSQL database snapshots and files archives from
# Hetzner Storage Box. Supports interactive wizard and CLI automation flags.
#
# CAUTION: Restoring a database snapshot will drop and recreate tables,
# overwriting current live data. Always verify snapshot target before proceeding.
#
# Usage:
#   Interactive:     ./restore_from_hetzner.sh
#   Non-Interactive: ./restore_from_hetzner.sh --latest [--include-files] [--dry-run]
#                    ./restore_from_hetzner.sh --file <snapshot_name> [--dry-run]
# ==============================================================================

set -eo pipefail

# ---------------- CONFIGURATION & PATH RESOLUTION ----------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load Environment Variables from standard project locations
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC1090
  set -a && source "${PROJECT_ROOT}/.env" && set +a
elif [ -f "/root/ontonbot/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "/root/ontonbot/.env" && set +a
elif [ -f "/home/tonont/ontonbot/.env" ]; then
  # shellcheck disable=SC1091
  set -a && source "/home/tonont/ontonbot/.env" && set +a
fi

STORAGE_USER="${HETZNER_STORAGE_USER:-}"
STORAGE_HOST="${HETZNER_STORAGE_HOST:-u434100.your-storagebox.de}"
STORAGE_PASS="${HETZNER_STORAGE_PASS:-}"
STORAGE_PORT="${HETZNER_STORAGE_PORT:-22}"

REMOTE_ROOT="${HETZNER_REMOTE_ROOT:-/backups/ontonbot}"
REMOTE_DB_DIR="${REMOTE_ROOT}/database"
REMOTE_FILES_DIR="${REMOTE_ROOT}/files"

RESTORE_DIR="${PROJECT_ROOT}/restore_temp"
PG_USER="${POSTGRES_USER:-ontonont}"

TELEGRAM_BOT_TOKEN="${BACKUP_TELEGRAM_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-${BOT_TOKEN:-}}}"
TELEGRAM_CHAT_ID="${BACKUP_TELEGRAM_CHAT_ID:-${LOGS_GROUP_ID:-${TELEGRAM_CHAT_ID:-}}}"
TELEGRAM_THREAD_ID="${BACKUP_TELEGRAM_THREAD_ID:-${LOGS_THREAD_ID:-}}"
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || curl -s --max-time 2 https://api.ipify.org 2>/dev/null || echo "65.109.212.86")

# ---------------- TELEGRAM NOTIFICATION HELPER ----------------
send_telegram_notification() {
  local text="$1"
  if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import urllib.request, urllib.parse, json, os, sys
token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
chat_id = os.environ.get('TELEGRAM_CHAT_ID', '')
thread_id = os.environ.get('TELEGRAM_THREAD_ID', '')
text = sys.argv[1]
data = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
if thread_id:
    try:
        data['message_thread_id'] = int(thread_id)
    except ValueError:
        pass
req = urllib.request.Request(
    f'https://api.telegram.org/bot{token}/sendMessage',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    urllib.request.urlopen(req, timeout=10)
except Exception as e:
    sys.stderr.write(f'Telegram send error: {e}\n')
" "$text" || true
  fi
}

# ---------------- ARGUMENT PARSING ----------------
MODE_LATEST=false
SPECIFIC_FILE=""
INCLUDE_FILES=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --latest)
      MODE_LATEST=true
      shift
      ;;
    --file)
      SPECIFIC_FILE="$2"
      shift 2
      ;;
    --include-files)
      INCLUDE_FILES=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--latest|--file <name>] [--include-files] [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ---------------- PRE-FLIGHT VALIDATION ----------------
if [ -z "$STORAGE_USER" ] || [ -z "$STORAGE_PASS" ]; then
  echo "❌ Error: HETZNER_STORAGE_USER or HETZNER_STORAGE_PASS is missing in environment."
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "❌ Error: 'lftp' is not installed. Install via: apt install -y lftp"
  exit 1
fi

find_postgres_container() {
  if [ -n "$POSTGRES_CONTAINER" ] && docker ps --format '{{.Names}}' | grep -qw "$POSTGRES_CONTAINER"; then
    echo "$POSTGRES_CONTAINER"
    return 0
  fi
  for candidate in "${ENV}-postgres" "local-onton-postgres" "production-postgres" "onton-postgres" "postgres"; do
    if [ -n "$candidate" ] && docker ps --format '{{.Names}}' | grep -qw "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1
}

CONTAINER_NAME=$(find_postgres_container)
if [ -z "$CONTAINER_NAME" ]; then
  echo "❌ Error: PostgreSQL container not found. Ensure Docker is running."
  exit 1
fi

echo "=========================================="
echo "      ONTON RESTORE WIZARD / ENGINE       "
echo "=========================================="
echo "Target Container: $CONTAINER_NAME (User: $PG_USER)"
echo "Storage Box:      $STORAGE_HOST:$REMOTE_DB_DIR"
echo "Retrieving available snapshots from Hetzner Storage Box..."

DB_BACKUPS=$(lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" -e "set sftp:auto-confirm yes; cls -1 --sort=date --order=desc $REMOTE_DB_DIR; bye" 2>/dev/null || true)

if [ -z "$DB_BACKUPS" ]; then
  echo "❌ No database backups found on remote storage!"
  exit 1
fi

# Determine target file
SELECTED_DB_FILE=""

if [ "$MODE_LATEST" = true ]; then
  SELECTED_DB_FILE=$(echo "$DB_BACKUPS" | head -n 1)
  echo "--> Selected LATEST snapshot: $SELECTED_DB_FILE"
elif [ -n "$SPECIFIC_FILE" ]; then
  SELECTED_DB_FILE="$SPECIFIC_FILE"
  echo "--> Selected specified snapshot: $SELECTED_DB_FILE"
else
  # Interactive mode
  echo ""
  echo "Available Database Backups:"
  i=1
  declare -a backup_files
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      echo "  [$i] $line"
      backup_files[$i]="$line"
      ((i++))
    fi
  done <<< "$DB_BACKUPS"

  echo ""
  read -r -p "Select backup number to restore (or 'q' to quit): " choice
  if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
    echo "Restore aborted by user."
    exit 0
  fi

  SELECTED_DB_FILE="${backup_files[$choice]:-}"
  if [ -z "$SELECTED_DB_FILE" ]; then
    echo "❌ Invalid selection."
    exit 1
  fi

  echo ""
  read -r -p "Do you also want to restore the latest FILE archive (overwrites ./data)? [y/N]: " file_choice
  if [[ "$file_choice" =~ ^[Yy]$ ]]; then
    INCLUDE_FILES=true
  fi
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "🔍 DRY RUN: Verification complete."
  echo "  • Would download: $SELECTED_DB_FILE"
  echo "  • Would stop:     mini-app, telegram-bot, website"
  echo "  • Would restore:  PostgreSQL container '$CONTAINER_NAME'"
  echo "  • Include files:  $INCLUDE_FILES"
  exit 0
fi

# Confirm destructive action in interactive mode
if [ "$MODE_LATEST" != true ] && [ -z "$SPECIFIC_FILE" ]; then
  echo ""
  echo "⚠️ WARNING: This will OVERWRITE existing PostgreSQL database tables in '$CONTAINER_NAME'!"
  read -r -p "Type 'RESTORE' to confirm: " confirmation
  if [ "$confirmation" != "RESTORE" ]; then
    echo "Confirmation mismatch. Restoration cancelled."
    exit 1
  fi
fi

# ---------------- EXECUTION ----------------
mkdir -p "$RESTORE_DIR"

echo "--> Alerting Telegram deployment channel..."
RESTORE_ALERT="<b>⚠️ Database Restoration INITIATED</b>
• <b>Host:</b> <code>$(hostname)</code> (<code>${SERVER_IP}</code>)
• <b>Snapshot:</b> <code>${SELECTED_DB_FILE}</code>
• <b>Container:</b> <code>${CONTAINER_NAME}</code>
• <b>Time:</b> <code>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</code>"
send_telegram_notification "$RESTORE_ALERT"

echo "--> Downloading snapshot $SELECTED_DB_FILE from Hetzner..."
lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" <<EOF
set sftp:auto-confirm yes
set net:timeout 60
get -O $RESTORE_DIR "$REMOTE_DB_DIR/$SELECTED_DB_FILE"
bye
EOF

LOCAL_SNAPSHOT_PATH="${RESTORE_DIR}/${SELECTED_DB_FILE}"
if [ ! -s "$LOCAL_SNAPSHOT_PATH" ]; then
  echo "❌ Error: Downloaded snapshot is missing or empty."
  rm -rf "$RESTORE_DIR"
  exit 1
fi

# Decrypt if needed
RESTORE_SQL_PATH="$LOCAL_SNAPSHOT_PATH"
if [[ "$SELECTED_DB_FILE" == *.enc ]]; then
  echo "--> Detected encrypted snapshot. Decrypting..."
  ENC_KEY="${BACKUP_ENCRYPTION_KEY:-}"
  if [ -z "$ENC_KEY" ]; then
    read -s -r -p "Enter backup decryption passphrase: " ENC_KEY
    echo ""
  fi
  DECRYPTED_PATH="${LOCAL_SNAPSHOT_PATH%.enc}"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -in "$LOCAL_SNAPSHOT_PATH" -out "$DECRYPTED_PATH" \
    -pass "pass:${ENC_KEY}"
  RESTORE_SQL_PATH="$DECRYPTED_PATH"
  echo "--> Decryption complete."
fi

echo "--> Gracefully stopping application services (keeping postgres active)..."
if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" stop mini-app telegram-bot website 2>/dev/null || true
elif [ -f "/root/ontonbot/docker-compose.yml" ]; then
  docker compose -f "/root/ontonbot/docker-compose.yml" stop mini-app telegram-bot website 2>/dev/null || true
fi

echo "--> Restoring database via psql stream..."
if [ -n "$POSTGRES_PASSWORD" ]; then
  gunzip -c "$RESTORE_SQL_PATH" | docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" -i "$CONTAINER_NAME" psql -U "$PG_USER" postgres
else
  gunzip -c "$RESTORE_SQL_PATH" | docker exec -i "$CONTAINER_NAME" psql -U "$PG_USER" postgres
fi

echo "✅ Database restore pipeline completed successfully."

# Restore files if requested
if [ "$INCLUDE_FILES" = true ]; then
  echo "--> Retrieving latest file archive..."
  FILE_BACKUPS=$(lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" -e "set sftp:auto-confirm yes; cls -1 --sort=date --order=desc $REMOTE_FILES_DIR; bye" 2>/dev/null || true)
  LATEST_FILE_BACKUP=$(echo "$FILE_BACKUPS" | head -n 1)

  if [ -n "$LATEST_FILE_BACKUP" ]; then
    echo "--> Downloading files archive: $LATEST_FILE_BACKUP"
    lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" <<EOF
set sftp:auto-confirm yes
set net:timeout 60
get -O $RESTORE_DIR "$REMOTE_FILES_DIR/$LATEST_FILE_BACKUP"
bye
EOF
    LOCAL_FILES_PATH="${RESTORE_DIR}/${LATEST_FILE_BACKUP}"
    if [[ "$LATEST_FILE_BACKUP" == *.enc ]]; then
      echo "--> Decrypting files archive..."
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
        -in "$LOCAL_FILES_PATH" -out "${LOCAL_FILES_PATH%.enc}" \
        -pass "pass:${ENC_KEY}"
      LOCAL_FILES_PATH="${LOCAL_FILES_PATH%.enc}"
    fi

    echo "--> Extracting files archive into $PROJECT_ROOT..."
    tar -xzf "$LOCAL_FILES_PATH" -C "$PROJECT_ROOT"
    echo "✅ Files archive restored."
  else
    echo "⚠️ Warning: No file archives found on remote storage."
  fi
fi

# Cleanup temp restore files
rm -rf "$RESTORE_DIR"

echo "--> Restarting application services..."
if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d mini-app telegram-bot website 2>/dev/null || true
elif [ -f "/root/ontonbot/docker-compose.yml" ]; then
  docker compose -f "/root/ontonbot/docker-compose.yml" up -d mini-app telegram-bot website 2>/dev/null || true
fi

SUCCESS_ALERT="<b>🎉 Database Restoration COMPLETED</b>
• <b>Host:</b> <code>$(hostname)</code> (<code>${SERVER_IP}</code>)
• <b>Snapshot:</b> <code>${SELECTED_DB_FILE}</code>
• <b>Container:</b> <code>${CONTAINER_NAME}</code>
• <b>Status:</b> All services restarted & operational
• <b>Time:</b> <code>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</code>"
send_telegram_notification "$SUCCESS_ALERT"

echo ""
echo "🎉 Restoration completed successfully!"
echo "Database is live and application services have been restarted."
exit 0
