#!/usr/bin/env bash

# ==============================================================================
# ONTON Automated Production Backup Script
# ==============================================================================
# Creates automated, compressed, encrypted PostgreSQL database snapshots and
# optional data directory archives, pushes them to Hetzner Storage Box via
# secure SFTP (lftp), enforces a 7-day daily / 4-week weekly / 3-month monthly
# retention policy, and sends Telegram alert notifications on success or failure.
#
# Usage:
#   ./backup_to_hetzner.sh [db-only|full]
#
# Arguments:
#   db-only : Backup PostgreSQL databases only (Default, recommended for daily cron)
#   full    : Backup PostgreSQL databases AND ./data directory (Recommended for weekly cron)
# ==============================================================================

set -eo pipefail

START_TIME=$(date +%s)
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
MODE="${1:-db-only}"

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

# Hetzner Storage Box Credentials
STORAGE_USER="${HETZNER_STORAGE_USER:-}"
STORAGE_HOST="${HETZNER_STORAGE_HOST:-u434100.your-storagebox.de}"
STORAGE_PASS="${HETZNER_STORAGE_PASS:-}"
STORAGE_PORT="${HETZNER_STORAGE_PORT:-22}"

# Remote Paths on Storage Box
REMOTE_ROOT="${HETZNER_REMOTE_ROOT:-/backups/ontonbot}"
REMOTE_DB_DIR="${REMOTE_ROOT}/database"
REMOTE_FILES_DIR="${REMOTE_ROOT}/files"

# Local Paths
BACKUP_DIR="${PROJECT_ROOT}/backups_temp"
mkdir -p "$BACKUP_DIR"

# Database Config
PG_USER="${POSTGRES_USER:-ontonont}"

# Telegram Alert Config
TELEGRAM_BOT_TOKEN="${BACKUP_TELEGRAM_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-${BOT_TOKEN:-}}}"
TELEGRAM_CHAT_ID="${BACKUP_TELEGRAM_CHAT_ID:-${LOGS_GROUP_ID:-${TELEGRAM_CHAT_ID:-}}}"
TELEGRAM_THREAD_ID="${BACKUP_TELEGRAM_THREAD_ID:-${LOGS_THREAD_ID:-}}"

# Resolve Server IP for telemetry
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || curl -s --max-time 2 https://api.ipify.org 2>/dev/null || echo "65.109.212.86")

# ---------------- TELEGRAM NOTIFICATION HELPER ----------------
send_telegram_notification() {
  local text="$1"
  if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "[Telegram] Notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID unset"
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
  else
    local extra_args=()
    if [ -n "$TELEGRAM_THREAD_ID" ]; then
      extra_args+=(-d "message_thread_id=${TELEGRAM_THREAD_ID}")
    fi
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      "${extra_args[@]}" \
      -d "parse_mode=HTML" \
      --data-urlencode "text=${text}" > /dev/null || true
  fi
}

# ---------------- ERROR HANDLER & TRAP ----------------
FAILED_STEP="Initialization"

on_failure() {
  local exit_code=$?
  local line_no=$1
  echo "❌ Error during step '${FAILED_STEP}' at line ${line_no} (Exit code: ${exit_code})"
  
  local error_msg="<b>🚨 ONTON Database Backup FAILED</b>
• <b>Host:</b> <code>$(hostname)</code> (<code>${SERVER_IP}</code>)
• <b>Step:</b> <code>${FAILED_STEP}</code>
• <b>Line:</b> <code>${line_no}</code>
• <b>Exit Code:</b> <code>${exit_code}</code>
• <b>Time:</b> <code>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</code>"

  send_telegram_notification "$error_msg"
  
  # Clean up partial artifacts
  rm -rf "$BACKUP_DIR"
  exit "$exit_code"
}
trap 'on_failure $LINENO' ERR

# ---------------- PRE-FLIGHT VALIDATION ----------------
echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Starting ONTON Backup Routine (Mode: $MODE)"

if [ -z "$STORAGE_USER" ] || [ -z "$STORAGE_PASS" ]; then
  FAILED_STEP="Credential Validation"
  echo "❌ Error: HETZNER_STORAGE_USER or HETZNER_STORAGE_PASS is missing in environment."
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  FAILED_STEP="Prerequisite Check (lftp)"
  echo "❌ Error: 'lftp' is not installed. Install via: apt install -y lftp"
  exit 1
fi

# Detect running postgres container dynamically
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
  FAILED_STEP="PostgreSQL Container Detection"
  echo "❌ Error: No running PostgreSQL container detected on host $(hostname)."
  exit 1
fi

echo "--> Target PostgreSQL Container: $CONTAINER_NAME (User: $PG_USER)"

# ---------------- STEP 1: DATABASE DUMP ----------------
FAILED_STEP="Database Dump"
echo "--> Executing pg_dumpall..."
DB_ARCHIVE_NAME="db_dump_${DATE}.sql.gz"
DB_ARCHIVE_PATH="${BACKUP_DIR}/${DB_ARCHIVE_NAME}"

# Execute pg_dumpall WITHOUT -t (allocating tty injects carriage returns / corrupts sql stream)
if [ -n "$POSTGRES_PASSWORD" ]; then
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" -i "$CONTAINER_NAME" pg_dumpall -c -U "$PG_USER" | gzip -9 > "$DB_ARCHIVE_PATH"
else
  docker exec -i "$CONTAINER_NAME" pg_dumpall -c -U "$PG_USER" | gzip -9 > "$DB_ARCHIVE_PATH"
fi

# Verify dump file existence and non-trivial size
if [ ! -s "$DB_ARCHIVE_PATH" ] || [ "$(wc -c < "$DB_ARCHIVE_PATH")" -lt 1024 ]; then
  echo "❌ Error: Dump file is empty or corrupted (< 1024 bytes)."
  exit 1
fi

# Optional symmetric encryption if BACKUP_ENCRYPTION_KEY is provided
FINAL_DB_PATH="$DB_ARCHIVE_PATH"
FINAL_DB_NAME="$DB_ARCHIVE_NAME"
if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
  FAILED_STEP="Database Encryption"
  echo "--> Encrypting database snapshot with AES-256-CBC..."
  ENC_PATH="${DB_ARCHIVE_PATH}.enc"
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$DB_ARCHIVE_PATH" -out "$ENC_PATH" \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}"
  rm -f "$DB_ARCHIVE_PATH"
  FINAL_DB_PATH="$ENC_PATH"
  FINAL_DB_NAME="${DB_ARCHIVE_NAME}.enc"
fi

FILE_SIZE_BYTES=$(wc -c < "$FINAL_DB_PATH" | tr -d ' ')
FILE_SIZE_HR=$(ls -lh "$FINAL_DB_PATH" | awk '{print $5}')
echo "--> Database archive created: $FINAL_DB_NAME ($FILE_SIZE_HR)"

# ---------------- STEP 2: UPLOAD DATABASE TO HETZNER ----------------
FAILED_STEP="Database Upload to Hetzner"
echo "--> Uploading snapshot to Hetzner Storage Box ($STORAGE_HOST:$REMOTE_DB_DIR)..."

lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" <<EOF
set sftp:auto-confirm yes
set net:timeout 30
set net:max-retries 3
mkdir -p $REMOTE_DB_DIR
put -O $REMOTE_DB_DIR $FINAL_DB_PATH
bye
EOF

echo "--> Database upload verified successfully."

# ---------------- STEP 3: OPTIONAL FILE BACKUP (FULL MODE) ----------------
FILES_ARCHIVE_NAME=""
if [ "$MODE" = "full" ]; then
  FAILED_STEP="Files Directory Archive"
  echo "--> Archiving ./data directory..."
  FILES_ARCHIVE_NAME="files_dump_${DATE}.tar.gz"
  FILES_ARCHIVE_PATH="${BACKUP_DIR}/${FILES_ARCHIVE_NAME}"

  if [ -d "${PROJECT_ROOT}/data" ]; then
    tar -czf "$FILES_ARCHIVE_PATH" -C "$PROJECT_ROOT" data
  elif [ -d "/root/ontonbot/data" ]; then
    tar -czf "$FILES_ARCHIVE_PATH" -C "/root/ontonbot" data
  else
    echo "⚠️ Warning: data directory not found; skipping files archive."
    FILES_ARCHIVE_NAME=""
  fi

  if [ -n "$FILES_ARCHIVE_NAME" ] && [ -s "$FILES_ARCHIVE_PATH" ]; then
    FINAL_FILES_PATH="$FILES_ARCHIVE_PATH"
    FINAL_FILES_NAME="$FILES_ARCHIVE_NAME"

    if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
      FAILED_STEP="Files Encryption"
      echo "--> Encrypting files archive with AES-256-CBC..."
      ENC_FILES_PATH="${FILES_ARCHIVE_PATH}.enc"
      openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "$FILES_ARCHIVE_PATH" -out "$ENC_FILES_PATH" \
        -pass "pass:${BACKUP_ENCRYPTION_KEY}"
      rm -f "$FILES_ARCHIVE_PATH"
      FINAL_FILES_PATH="$ENC_FILES_PATH"
      FINAL_FILES_NAME="${FILES_ARCHIVE_NAME}.enc"
    fi

    FAILED_STEP="Files Upload to Hetzner"
    echo "--> Uploading files archive to Hetzner Storage Box ($REMOTE_FILES_DIR)..."
    lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" <<EOF
set sftp:auto-confirm yes
set net:timeout 60
set net:max-retries 3
mkdir -p $REMOTE_FILES_DIR
put -O $REMOTE_FILES_DIR $FINAL_FILES_PATH
bye
EOF
    echo "--> Files archive uploaded: $FINAL_FILES_NAME"
  fi
fi

# ---------------- STEP 4: RETENTION POLICY ENFORCEMENT ----------------
FAILED_STEP="Retention Policy Pruning"
echo "--> Enforcing backup retention policy (7 daily, 4 weekly, 3 monthly)..."

DELETED_COUNT=0
REMOTE_LIST=$(lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" -e "set sftp:auto-confirm yes; cls -1 --sort=date $REMOTE_DB_DIR; bye" 2>/dev/null || true)

if [ -n "$REMOTE_LIST" ] && [ -f "${SCRIPT_DIR}/retention_policy.py" ]; then
  FILES_TO_DELETE=$(echo "$REMOTE_LIST" | python3 "${SCRIPT_DIR}/retention_policy.py" --action=delete 2>/dev/null || true)
  
  if [ -n "$FILES_TO_DELETE" ]; then
    LFTP_CMDS="set sftp:auto-confirm yes; "
    while IFS= read -r file_to_del; do
      if [ -n "$file_to_del" ]; then
        LFTP_CMDS="${LFTP_CMDS}rm ${REMOTE_DB_DIR}/${file_to_del}; "
        ((DELETED_COUNT++))
      fi
    done <<< "$FILES_TO_DELETE"

    if [ "$DELETED_COUNT" -gt 0 ]; then
      echo "--> Pruning ${DELETED_COUNT} expired snapshot(s) from remote storage..."
      lftp -u "$STORAGE_USER","$STORAGE_PASS" -p "$STORAGE_PORT" "sftp://$STORAGE_HOST" -e "${LFTP_CMDS}bye" 2>/dev/null || true
    fi
  fi
fi
echo "--> Retention enforcement completed: ${DELETED_COUNT} snapshot(s) pruned."

# ---------------- STEP 5: CLEANUP LOCAL TEMP ----------------
FAILED_STEP="Local Cleanup"
echo "--> Cleaning up local temporary backup directory..."
rm -rf "$BACKUP_DIR"

# ---------------- STEP 6: TELEGRAM SUCCESS NOTIFICATION ----------------
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

SUCCESS_MSG="<b>✅ ONTON Database Backup Succeeded</b>
• <b>Host:</b> <code>$(hostname)</code> (<code>${SERVER_IP}</code>)
• <b>Container:</b> <code>${CONTAINER_NAME}</code>
• <b>Mode:</b> <code>${MODE}</code>
• <b>Snapshot:</b> <code>${FINAL_DB_NAME}</code> (${FILE_SIZE_HR})
• <b>Duration:</b> ${DURATION}s
• <b>Remote:</b> Hetzner Storage Box (<code>${REMOTE_DB_DIR}</code>)
• <b>Retention:</b> Pruned ${DELETED_COUNT} expired snapshot(s)"

echo "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] Backup successfully completed in ${DURATION}s."
send_telegram_notification "$SUCCESS_MSG"

exit 0
