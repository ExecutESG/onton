#!/bin/bash

# Check if branch name is provided as an argument
if [ -z "$1" ]; then
  echo "Error: Branch name is required as a parameter."
  echo "Usage: $0 <branch-name>"
  exit 1
fi

BRANCH_NAME="$1"
CURRENT_USER=tonont
DATE=$(date +"%Y-%m-%d-%H-%M-%S")
LOG_FILE="/home/$CURRENT_USER/backup_log_${BRANCH_NAME}_${DATE}.txt"
TELEGRAM_BOT_TOKEN_FILE="bottoken.pass"
PASSWORD_FILE="7z.pass"

# Validate password file
if [ ! -f "$PASSWORD_FILE" ]; then
  echo "Error: 7z password file not found at $PASSWORD_FILE."
  exit 1
fi

PASSWORD=$(<"$PASSWORD_FILE")

if [ ! -f "$TELEGRAM_BOT_TOKEN_FILE" ]; then
  echo "Error: Telegram bot token file not found at $TELEGRAM_BOT_TOKEN_FILE."
  exit 1
fi

TELEGRAM_BOT_TOKEN=$(<"$TELEGRAM_BOT_TOKEN_FILE")
TELEGRAM_CHAT_ID="-1003715829795"  # Replace with your chat ID

# Redirect all output to a log file
exec > >(tee -i "$LOG_FILE") 2>&1

# Load environment variables
ENV_FILE="/home/$CURRENT_USER/${BRANCH_NAME}/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file not found at $ENV_FILE."
  exit 1
fi

set -o allexport && source "$ENV_FILE" && set +o allexport

# Define backup paths
BACKUP_BASE="/home/$CURRENT_USER/backups"
BACKUP_ROOT="$BACKUP_BASE/${BRANCH_NAME}"
MINI_APP_BACKUP_PATH="$BACKUP_ROOT/${POSTGRES_MINI_APP_DB}"
NFT_MANAGER_BACKUP_PATH="$BACKUP_ROOT/${POSTGRES_NFT_MANAGER_DB}"
MINIO_BACKUP_PATH="$BACKUP_ROOT/minio"

mkdir -p "$MINI_APP_BACKUP_PATH" "$NFT_MANAGER_BACKUP_PATH" "$MINIO_BACKUP_PATH"

# Backup Postgres mini-app database
echo "Backing up Postgres mini-app database..."
pg_dump "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_MINI_APP_DB}" \
  -F c -b -v -f "${MINI_APP_BACKUP_PATH}/${POSTGRES_MINI_APP_DB}.${DATE}.back"

# Ensure the backup file exists before compressing
if [ -f "${MINI_APP_BACKUP_PATH}/${POSTGRES_MINI_APP_DB}.${DATE}.back" ]; then
  echo "Compressing mini-app database backup..."
  nice -n 19 7z a -p"$PASSWORD" "${MINI_APP_BACKUP_PATH}/${POSTGRES_MINI_APP_DB}.${DATE}.7z" \
    "${MINI_APP_BACKUP_PATH}/${POSTGRES_MINI_APP_DB}.${DATE}.back"

  # Only delete the file if compression succeeded
  if [ $? -eq 0 ]; then
    rm -f "${MINI_APP_BACKUP_PATH}/${POSTGRES_MINI_APP_DB}.${DATE}.back"
  else
    echo "Error: Compression failed for mini-app database."
  fi
else
  echo "Error: Mini-app backup file not found. Skipping compression."
fi

# Backup Postgres NFT manager database
echo "Backing up Postgres NFT manager database..."
pg_dump "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_NFT_MANAGER_DB}" \
  -F c -b -v -f "${NFT_MANAGER_BACKUP_PATH}/${POSTGRES_NFT_MANAGER_DB}.${DATE}.back"

# Ensure the backup file exists before compressing
if [ -f "${NFT_MANAGER_BACKUP_PATH}/${POSTGRES_NFT_MANAGER_DB}.${DATE}.back" ]; then
  echo "Compressing NFT manager database backup..."
  nice -n 19 7z a -p"$PASSWORD" "${NFT_MANAGER_BACKUP_PATH}/${POSTGRES_NFT_MANAGER_DB}.${DATE}.7z" \
    "${NFT_MANAGER_BACKUP_PATH}/${POSTGRES_NFT_MANAGER_DB}.${DATE}.back"

  # Only delete the file if compression succeeded
  if [ $? -eq 0 ]; then
    rm -f "${NFT_MANAGER_BACKUP_PATH}/${POSTGRES_NFT_MANAGER_DB}.${DATE}.back"
  else
    echo "Error: Compression failed for NFT manager database."
  fi
else
  echo "Error: NFT manager backup file not found. Skipping compression."
fi

# Backup Minio data
echo "Backing up Minio data..."
MINIO_VOLUME_PATH=$(docker volume inspect "${STAGE_NAME}_minio_data" --format '{{ .Mountpoint }}')
tar -czvf "$MINIO_BACKUP_PATH/minio-${DATE}.tar.gz" -C "$MINIO_VOLUME_PATH" .

# Ensure the tarball exists before compressing
if [ -f "$MINIO_BACKUP_PATH/minio-${DATE}.tar.gz" ]; then
  echo "Compressing Minio data backup..."
  nice -n 19 7z a -p"$PASSWORD" "${MINIO_BACKUP_PATH}/minio-${DATE}.7z" \
    "$MINIO_BACKUP_PATH/minio-${DATE}.tar.gz"

  # Only delete the file if compression succeeded
  if [ $? -eq 0 ]; then
    rm -f "$MINIO_BACKUP_PATH/minio-${DATE}.tar.gz"
  else
    echo "Error: Compression failed for Minio data."
  fi
else
  echo "Error: Minio tarball not found. Skipping compression."
fi

echo "All backups compressed successfully."
echo "Start transferring backups to Hetzner Storage Box..."

# Rsync backups to Hetzner Storage Box
HETZNER_USER="u434100"
HETZNER_HOST="u434100.your-storagebox.de"
HETZNER_PORT=23
HETZNER_TARGET_DIR="backups"

STORAGE_PASS_FILE="storage.pass"
if [ ! -f "$STORAGE_PASS_FILE" ]; then
  echo "Error: Storage Box password file not found at $STORAGE_PASS_FILE."
  exit 1
fi

sshpass -f "$STORAGE_PASS_FILE" rsync -avz -e "ssh -p $HETZNER_PORT" \
  "${BACKUP_BASE}/" \
  "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_TARGET_DIR}/"

if [ $? -ne 0 ]; then
  echo "Error: Failed to transfer backups to Hetzner Storage Box."
  exit 1
fi

echo "All backups transferred successfully to Hetzner Storage Box at ${HETZNER_TARGET_DIR}/."

# Send log file and message to Telegram
MESSAGE="💾💾 Backup completed successfully for branch: $BRANCH_NAME on $DATE"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  -d text="$MESSAGE"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
  -F chat_id="${TELEGRAM_CHAT_ID}" \
  -F document=@"$LOG_FILE"

echo "Backup log sent to Telegram."

exit 0
