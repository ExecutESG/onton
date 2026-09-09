# minimum-image
FROM node:22-alpine3.19 AS minimum-image
RUN apk update
RUN apk add nano
RUN npm i -g pnpm@9.15.4

# Base image
FROM minimum-image AS base
# Build arguments to accept environment variables
ARG BOT_TOKEN
ARG ONTON_API_KEY
ARG NEXT_PUBLIC_BOT_USERNAME
ARG NEXT_PUBLIC_API_BASE_URL
ARG NFT_MANAGER_PORT
ARG PARTICIPANT_TMA_PORT
ARG MINI_APP_DOMAIN
ARG MINI_APP_PORT
ARG NODE_TLS_REJECT_UNAUTHORIZED
# Export arguments as environment variables
ENV BOT_TOKEN=${BOT_TOKEN}
ENV ONTON_API_KEY=${ONTON_API_KEY}
ENV NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NFT_MANAGER_PORT=${NFT_MANAGER_PORT}
ENV PARTICIPANT_TMA_PORT=${PARTICIPANT_TMA_PORT}
ENV MINI_APP_DOMAIN=${MINI_APP_DOMAIN}
ENV MINI_APP_PORT=${MINI_APP_PORT}
ENV NODE_TLS_REJECT_UNAUTHORIZED=${NODE_TLS_REJECT_UNAUTHORIZED}

# production base image
FROM base AS base-prod
# Install necessary packages
RUN apk add  \
  bash \
  curl \
  ca-certificates
# Dependencies stage
FROM base-prod AS dependencies
# Copy all necessary files from the workspace root
COPY  ../../ /app/
# Install production dependencies only
WORKDIR /app/
# Install production dependencies only
RUN pnpm install
WORKDIR /app/apps/nft-manager/

# Development stage (includes devDependencies)
FROM base AS development
COPY  ../../ /app/
# Copy all necessary files from the workspace root
WORKDIR /app/
RUN echo "Development stage files " && ls -la
RUN  pnpm install
WORKDIR /app/apps/nft-manager/
CMD export NODE_ENV=development && pnpm install && pnpm run dev:server

# Build stage
FROM dependencies AS build
# Build the application
RUN pnpm build
# Remove the source code
RUN rm -rf /app/apps/participant-tma

# Production stage
FROM build AS production
# Run the app in production mode
CMD ["pnpm", "start:prod"]

