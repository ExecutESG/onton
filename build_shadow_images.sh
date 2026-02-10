#!/bin/bash
set -e

echo "Building Shadow Images Locally..."

cd /home/tonont/ontonbot

# 1. Build Website
echo "Building Website..."
docker build -t ghcr.io/executesg/onton/website:main-latest ./website

# Source .env.shadow for build args
if [ -f ../.env.shadow ]; then
    set -a
    source ../.env.shadow
    set +a
fi

# 2. Build Mini-App
echo "Building Mini-App..."
docker build \
    --target production \
    --build-arg NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL \
    --build-arg NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME \
    --build-arg NEXT_PUBLIC_ENV=$ENV \
    -t ghcr.io/executesg/onton/mini-app:main-latest ./mini-app

# 3. Tag Mini-App as Worker
echo "Tagging Mini-App as Worker..."
docker tag ghcr.io/executesg/onton/mini-app:main-latest ghcr.io/executesg/onton/mini-app-ordinary-worker:main-latest

# 4. Build Telegram Bot
echo "Building Telegram Bot..."
docker build -t ghcr.io/executesg/onton/telegram-bot:main-latest ./telegram-bot

# 5. Build Caddy (Custom Image)
echo "Building Caddy..."
# Create a temp Dockerfile in caddy dir if not exists
if [ ! -f ./caddy/Dockerfile ]; then
    echo "FROM caddy:alpine" > ./caddy/Dockerfile.temp
    echo "COPY Caddyfile /etc/caddy/Caddyfile" >> ./caddy/Dockerfile.temp
    docker build -t ghcr.io/executesg/onton/caddy:main-latest -f ./caddy/Dockerfile.temp ./caddy
    rm ./caddy/Dockerfile.temp
else
    docker build -t ghcr.io/executesg/onton/caddy:main-latest ./caddy
fi

echo "All Shadow Images Built Successfully!"
