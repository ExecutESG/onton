#!/bin/bash
set -e

echo "Starting Shadow Deployment (Swarm Mode)..."

# 1. Prepare Directory Structure
cd /home/tonont/

# 2. Extract Codebase (if not already done)
if [ ! -d "ontonbot/caddy" ]; then
    if [ -f ontonbot_code.tar.gz ]; then
        echo "Extracting codebase..."
        tar -xzf ontonbot_code.tar.gz
    else
        echo "Error: ontonbot_code.tar.gz not found!"
        exit 1
    fi
fi

cd ontonbot

# 3. Apply Shadow Configuration
echo "Applying shadow configuration..."
if [ -f ../docker-compose-shadow.yml ]; then
    cp ../docker-compose-shadow.yml docker-compose.yml
fi
if [ -f ../.env.shadow ]; then
    cp ../.env.shadow .env
fi

# Load Environment Variables into Shell for Swarm interpolation
set -a
source .env
set +a

# 4. Deploy Infrastructure via Swarm
# We deploy the whole stack, but data restoration will happen on the running containers.
echo "Deploying stack 'onton'..."
docker stack deploy -c docker-compose.yml onton

# 5. Wait for Infrastructure Services
echo "Waiting 30s for services to stabilize..."
sleep 30

# 6. Restore Database
# Find the actual running container ID for postgres
echo "Locating Postgres container..."
POSTGRES_ID=""
for i in {1..30}; do
    POSTGRES_ID=$(docker ps --filter "name=onton_postgres" --filter "status=running" --format "{{.ID}}" | head -n 1)
    if [ -n "$POSTGRES_ID" ]; then
        break
    fi
    echo "Waiting for Postgres container... ($i/30)"
    sleep 2
done

if [ -n "$POSTGRES_ID" ]; then
    echo "Found Postgres: $POSTGRES_ID"
    # Check if DB is actually ready to accept connections
    echo "Waiting for Postgres to accept connections..."
    sleep 10 
    
    if [ -f ../prod_db_dump.sql.gz ]; then
        echo "Restoring Database from dump..."
        zcat ../prod_db_dump.sql.gz | docker exec -i $POSTGRES_ID psql -U onton -d onton_db
        echo "Database restore completed."
    else
        echo "Warning: prod_db_dump.sql.gz not found, skipping DB restore."
    fi
else
    echo "Error: Postgres container failed to start."
fi

# 7. Restore Minio Data
echo "Locating Minio container..."
MINIO_ID=$(docker ps --filter "name=onton_minio" --filter "status=running" --format "{{.ID}}" | head -n 1)

if [ -n "$MINIO_ID" ]; then
    echo "Found Minio: $MINIO_ID"
    if [ -f ../minio_backup.tar.gz ]; then
        echo "Restoring Minio Data..."
        # Extract to temp and copy
        mkdir -p /tmp/minio_restore
        # Check tar layout logic
        tar -xzf ../minio_backup.tar.gz -C /tmp/minio_restore
        
        # Check if minio_data is in the root of extracted folder
        if [ -d "/tmp/minio_restore/minio_data" ]; then
             docker cp /tmp/minio_restore/minio_data/. $MINIO_ID:/data/
        else
             docker cp /tmp/minio_restore/. $MINIO_ID:/data/
        fi
        
        rm -rf /tmp/minio_restore
        echo "Minio restore completed."
    fi
else
    echo "Warning: Minio container not found."
fi

echo "Shadow Deployment Complete!"
docker stack services onton
