##
# Stage: minimum-image
##
FROM node:22-alpine3.19 AS minimum-image

# Install basic utilities
RUN apk update && apk add --no-cache nano

# Enable corepack to use Yarn
# Disable corepack to avoid signature verification
RUN corepack disable

# Install Yarn globally
RUN npm install -g yarn

# ARGS
ARG ENV
ARG NEXT_PUBLIC_ENV
ARG DATABASE_URL_NFT_MANAGER
ARG TON_CENTER_TOKEN
ARG TONAPI_API_KEY
ARG DATABASE_URL
ARG POSTGRES_USER
ARG POSTGRES_PASSWORD
ARG BOT_TOKEN
ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_BOT_USERNAME
ARG CACHE_ENABLED
ARG TG_NOTIFICATION_CHANELL
ARG ONTON_API_SECRET
ARG TON_SOCIETY_API_KEY
ARG TON_SOCIETY_BASE_URL
ARG REDIS_HOST
ARG REDIS_PORT
ARG REDIS_PASSWORD
ARG REDIS_DATABASES
ARG MINI_APP_PORT
ARG IP_NFT_MANAGER
ARG NFT_MANAGER_PORT
ARG CLIENT_API_JWT_SECRET
ARG CLIENT_API_FIXED_KEY
ARG CLIENT_API_FIXED_USER
ARG CLIENT_API_FIXED_ORGANIZER
ARG NEXT_PUBLIC_SOCKET_URL
ARG IP_REDIS
ARG EVENT_WALLET_ENC_KEY
# Export arguments as environment variables
ENV ENV=${ENV}
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV DATABASE_URL_NFT_MANAGER=${DATABASE_URL_NFT_MANAGER}
ENV TON_CENTER_TOKEN=${TON_CENTER_TOKEN}
ENV TONAPI_API_KEY=${TONAPI_API_KEY}
ENV DATABASE_URL=${DATABASE_URL}
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV BOT_TOKEN=${BOT_TOKEN}
ENV NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}
ENV NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}
ENV CACHE_ENABLED=${CACHE_ENABLED}
ENV TG_NOTIFICATION_CHANELL=${TG_NOTIFICATION_CHANELL}
ENV ONTON_API_SECRET=${ONTON_API_SECRET}
ENV TON_SOCIETY_API_KEY=${TON_SOCIETY_API_KEY}
ENV TON_SOCIETY_BASE_URL=${TON_SOCIETY_BASE_URL}
ENV REDIS_HOST=${IP_REDIS}
ENV IP_REDIS=${IP_REDIS}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_DATABASES=${REDIS_DATABASES}
ENV MINI_APP_PORT=${MINI_APP_PORT}
ENV IP_NFT_MANAGER=${IP_NFT_MANAGER}
ENV NFT_MANAGER_PORT=${NFT_MANAGER_PORT}
ENV CLIENT_API_JWT_SECRET=${CLIENT_API_JWT_SECRET}
ENV CLIENT_API_FIXED_KEY=${CLIENT_API_FIXED_KEY}
ENV CLIENT_API_FIXED_USER=${CLIENT_API_FIXED_USER}
ENV CLIENT_API_FIXED_ORGANIZER=${CLIENT_API_FIXED_ORGANIZER}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV EVENT_WALLET_ENC_KEY=${EVENT_WALLET_ENC_KEY}

##
# Stage: base
##
FROM minimum-image AS base

# Install any additional packages you need at runtime/build
RUN apk add --no-cache \
    bash \
    curl \
    ca-certificates \
    ffmpeg \
    freetype \
    ttf-dejavu

##
# Stage: dependencies
##
FROM base AS dependencies

# Set the working directory
WORKDIR /app

# Copy package files for dependency installation (both package.json and yarn.lock)
COPY ./package.json ./yarn.lock* /app/

# Install all dependencies with frozen lockfile for deterministic, fast builds
RUN yarn install --frozen-lockfile --ignore-engines

##
# Stage: build-stage
##
FROM dependencies AS build-stage

# Copy the entire project (node_modules is excluded by .dockerignore)
COPY . /app

# Build Next.js application, then prune build cache to keep image small
RUN yarn build && \
    rm -rf /app/.next/cache && \
    yarn cache clean

##
# Stage: production
##
FROM build-stage AS production

ARG COMMIT_SHA=""
ARG COMMIT_AUTHOR=""

# Write commit details if provided at build time (won't invalidate build-stage cache)
RUN if [ -n "$COMMIT_SHA" ]; then \
      printf "Commit SHA: %s\nCommit Author: %s\n" "$COMMIT_SHA" "$COMMIT_AUTHOR" > /app/commit_details.txt; \
    fi

# Expose the port for your Next.js app
EXPOSE $MINI_APP_PORT

# Default command for the Next.js app
CMD node ./node_modules/next/dist/bin/next start --port $MINI_APP_PORT

##
# Stage: development
##
FROM minimum-image AS development

# Copy the entire project
COPY . /app

# Set the working directory
WORKDIR /app

# Expose the development port
EXPOSE $MINI_APP_PORT

# Run the app in development mode
CMD export NODE_ENV=development && yarn install && yarn lint:quiet && yarn dev --port $MINI_APP_PORT
