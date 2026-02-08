#!/bin/sh
set -e
# Start Minio server in the background
minio server /data --address ":${MINIO_PORT}" --console-address ":${MINIO_DASHBOARD_PORT}" &
MINIO_PID=$!

# Wait for Minio server to start
echo "Waiting for Minio server to initialize..."
sleep 15

# Initialize Minio client (mc)
echo "Setting up Minio client alias..."
mc alias set local ${MINIO_PUBLIC_URL} ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# Wait for the Minio process to finish
wait $MINIO_PID

#echo "alias set local ${MINIO_PUBLIC_URL} ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}"
#mc ls local
#mc mb --ignore-existing local/${MINIO_COLLECTION_BUCKET}
#mc mb --ignore-existing local/${MINIO_ITEM_BUCKET}
#mc mb --ignore-existing local/${MINIO_IMAGE_BUCKET}
#mc mb --ignore-existing local/${MINIO_VIDEO_BUCKET}
#mc mb --ignore-existing local/${MINIO_DOC_BUCKET}
#mc mb --ignore-existing local/${MINIO_DOC_DEFAULT_BUCKET}
#mc anonymous set download local/${MINIO_COLLECTION_BUCKET}
#mc anonymous set download local/${MINIO_ITEM_BUCKET}
#mc anonymous set download local/${MINIO_IMAGE_BUCKET}
#mc anonymous set download local/${MINIO_VIDEO_BUCKET}
#mc anonymous set download local/${MINIO_DOC_BUCKET}
#mc anonymous set download local/${MINIO_DOC_DEFAULT_BUCKET}
#mc policy set download local/${MINIO_SBT_COLLECTIONS_BUCKET}


