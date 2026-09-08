#!/bin/bash

# ==============================================================================
# ONTON Restoration Script
# ==============================================================================
# This script lists available backups from Hetzner and allows interactive restoration.
# CAUTION: This will overwrite current data!
# ==============================================================================

# ---------------- CONFIGURATION ----------------
source ../../.env

STORAGE_USER="${HETZNER_STORAGE_USER:-u434100}"
STORAGE_HOST="${HETZNER_STORAGE_HOST:-u434100.your-storagebox.de}"
STORAGE_PASS="${HETZNER_STORAGE_PASS:-JAN3Hsq~Ey(9°ht}"

REMOTE_ROOT="/backups/ontonbot"
REMOTE_DB_DIR="${REMOTE_ROOT}/database"
REMOTE_FILES_DIR="${REMOTE_ROOT}/files"

PROJECT_ROOT="/root/ontonbot"
RESTORE_DIR="${PROJECT_ROOT}/restore_temp"
CONTAINER_NAME="${ENV}-postgres"
PG_USER="${POSTGRES_USER}"
# -----------------------------------------------

mkdir -p "$RESTORE_DIR"

echo "=========================================="
echo "      ONTON RESTORE WIZARD"
echo "=========================================="
echo "Retrieving backup list from Hetzner..."

# Fetch list of DB backups
# lftp cls output: file names only
DB_BACKUPS=$(lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" -e "cls -1 --sort=date --order=desc $REMOTE_DB_DIR; bye")

if [ -z "$DB_BACKUPS" ]; then
    echo "❌ No database backups found!"
    exit 1
fi

echo ""
echo "Available Database Backups:"
i=1
declare -a backup_files
while IFS= read -r line; do
    echo "[$i] $line"
    backup_files[$i]=$line
    ((i++))
done <<< "$DB_BACKUPS"

echo ""
read -p "Select backup number to restore (or q to quit): " choice

if [[ "$choice" == "q" ]]; then
    exit 0
fi

SELECTED_DB_FILE="${backup_files[$choice]}"
if [ -z "$SELECTED_DB_FILE" ]; then
    echo "❌ Invalid selection."
    exit 1
fi

echo "--> You selected: $SELECTED_DB_FILE"
echo ""
echo "Do you also want to restore the latest FILE backup?"
echo "1) Yes, restore files too (Overwrites ./data)"
echo "2) No, Database only"
read -p "Choice: " file_choice

# ---------------- EXECUTION ----------------

echo "--> Downloading Database Backup..."
lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" <<EOF
get -O $RESTORE_DIR "$REMOTE_DB_DIR/$SELECTED_DB_FILE"
bye
EOF

echo "--> Stopping Services (keeping postgres)..."
docker compose stop mini-app nft-manager participant-tma client-web

# Restore DB
echo "--> Restoring Database (This may take a moment)..."
# Unzip and pipe to psql
# We assume pg_dumpall was used, so it reconstructs everything
gunzip -c "$RESTORE_DIR/$SELECTED_DB_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$PG_USER" postgres
if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully."
else
    echo "❌ Database restore FAILED."
    exit 1
fi

# Restore Files if requested
if [[ "$file_choice" == "1" ]]; then
    echo "Retrieving latest file backup list..."
    FILE_BACKUPS=$(lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" -e "cls -1 --sort=date --order=desc $REMOTE_FILES_DIR; bye")
    LATEST_FILE_BACKUP=$(echo "$FILE_BACKUPS" | head -n 1) # Simple latest strategy for now

    if [ -n "$LATEST_FILE_BACKUP" ]; then
        echo "--> Downloading File Backup: $LATEST_FILE_BACKUP"
        lftp -u "$STORAGE_USER","$STORAGE_PASS" "sftp://$STORAGE_HOST" <<EOF
get -O $RESTORE_DIR "$REMOTE_FILES_DIR/$LATEST_FILE_BACKUP"
bye
EOF
        
        echo "--> Extracting Data (Overwriting local data)..."
        # Danger zone: overwriting data
        # Ensure we are in project root
        tar -xzf "$RESTORE_DIR/$LATEST_FILE_BACKUP" -C "$PROJECT_ROOT"
        echo "✅ Files restored."
    else
        echo "⚠️ No file backups found."
    fi
fi

# Cleanup
rm -rf "$RESTORE_DIR"

echo ""
echo "🎉 Restoration Complete."
echo "Please restart services manually: docker compose up -d"
