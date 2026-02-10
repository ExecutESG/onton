#!/bin/bash

# ==============================================================================
# ONTON Production Backup Script
# ==============================================================================
# This script creates backups of the Postgres databases and the data directory,
# then uploads them to a Hetzner Storage Box using lftp.
#
# Usage: ./backup_to_hetzner.sh [full|db-only]
#   full    : Backup Database AND Files (Default if no arg)
#   db-only : Backup Database ONLY
# ==============================================================================

# ---------------- CONFIGURATION ----------------
# Load Environment Variables from project root
source ../../.env

# Hetzner Storage Box Credentials
# PLEASE FILL THESE IN OR ENSURE THEY ARE EXPORTED
STORAGE_USER="${HETZNER_STORAGE_USER:-u434100}"
STORAGE_HOST="${HETZNER_STORAGE_HOST:-u434100.your-storagebox.de}"
STORAGE_PASS="${HETZNER_STORAGE_PASS:-JAN3Hsq~Ey(9°ht}"

# Remote Paths
REMOTE_ROOT="/backups/ontonbot"
REMOTE_DB_DIR="${REMOTE_ROOT}/database"
REMOTE_FILES_DIR="${REMOTE_ROOT}/files"

# Local Paths
PROJECT_ROOT="/root/ontonbot"
BACKUP_DIR="${PROJECT_ROOT}/backups_temp"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
CONTAINER_NAME="${ENV}-postgres"

# Database Config
PG_USER="${POSTGRES_USER}"
DB_MINI_APP="${POSTGRES_DB:-production-mini-app}" # Default if not in env
DB_NFT_MANAGER="${POSTGRES_NFT_DB:-production-nft-manager}" # Default if not in env

# -----------------------------------------------

# Create temp backup dir
mkdir -p "$BACKUP_DIR"

MODE=${1:-full}

echo "[$(date)] Starting Backup Routine: Mode=$MODE"

# Function to check if command succeeded
check_status() {
    if [ $? -ne 0 ]; then
        echo "❌ Error during: $1"
        exit 1
    fi
}

# 1. DATABASE BACKUP
echo "--> Dumping Databases..."
DB_ARCHIVE_NAME="db_dump_${DATE}.sql.gz"
DB_ARCHIVE_PATH="${BACKUP_DIR}/${DB_ARCHIVE_NAME}"

# We use docker exec to dump all databases or specific ones
# Dumping both key databases into one compressed file
docker exec -t "$CONTAINER_NAME" pg_dumpall -c -U "$PG_USER" | gzip > "$DB_ARCHIVE_PATH"
check_status "Database Dump"

echo "--> Uploading Database Backup to Hetzner..."
lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" <<EOF
mkdir -p $REMOTE_DB_DIR
put -O $REMOTE_DB_DIR $DB_ARCHIVE_PATH
bye
EOF
check_status "Database Upload"

# 2. FILE BACKUP (Only if mode is full)
if [ "$MODE" == "full" ]; then
    echo "--> Archiving Data Directory..."
    FILES_ARCHIVE_NAME="files_dump_${DATE}.tar.gz"
    FILES_ARCHIVE_PATH="${BACKUP_DIR}/${FILES_ARCHIVE_NAME}"

    # Archive the 'data' folder, excluding temp stuff if needed
    # We are in devops/backup_scripts, so data is at ../../data
    # But better to use absolute paths based on PROJECT_ROOT assumed structure
    
    # Using tar to compress data directory
    # Excluding redis_data/dump.rdb if it exists to ensure consistency? No, data dir is fine.
    # We navigate to project root to keep relative paths in tar clean
    tar -czf "$FILES_ARCHIVE_PATH" -C "$PROJECT_ROOT" data
    check_status "Files Archive"

    echo "--> Uploading File Backup to Hetzner..."
    lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" <<EOF
mkdir -p $REMOTE_FILES_DIR
put -O $REMOTE_FILES_DIR $FILES_ARCHIVE_PATH
bye
EOF
    check_status "File Upload"
fi

# 3. CLEANUP
echo "--> Cleaning up local temporary files..."
rm -f "$DB_ARCHIVE_PATH"
if [ -n "$FILES_ARCHIVE_PATH" ]; then
    rm -f "$FILES_ARCHIVE_PATH"
fi

echo "✅ Backup Completed Successfully!"
