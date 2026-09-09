# minimum required version of Node.js
FROM node:22-alpine3.19 AS minimum-image
RUN apk update
RUN apk add nano
# Update pnpm to a stable version compatible with workspace
RUN npm install --global pnpm@9.15.4


# Base stage
FROM minimum-image AS base
# ARGS
ARG BOT_TOKEN
ARG NEXT_PUBLIC_ENV
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
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV ONTON_API_KEY=${ONTON_API_KEY}
ENV NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NFT_MANAGER_PORT=${NFT_MANAGER_PORT}
ENV PARTICIPANT_TMA_PORT=${PARTICIPANT_TMA_PORT}
ENV MINI_APP_DOMAIN=${MINI_APP_DOMAIN}
ENV MINI_APP_PORT=${MINI_APP_PORT}
ENV NODE_TLS_REJECT_UNAUTHORIZED=${NODE_TLS_REJECT_UNAUTHORIZED}


# Install necessary packages
RUN apk add \
  bash \
  curl \
  ca-certificates
# Set the working directory


# Dependencies stage
FROM base AS dependencies
# Copy package files for dependency installation
# Copy all necessary files from the workspace root
COPY  ./ /app
# Install production dependencies only
WORKDIR /app/
# Set this ENV so pnpm won't ask interactive questions
ENV CI=true
# Install production dependencies only
RUN pnpm install



# Development stage (includes devDependencies)
FROM base AS development
# Copy all necessary files from the workspace root
COPY ./ /app/

# Set the working directory for participant-tma
WORKDIR /app/apps/participant-tma
# Expose the default port for development mode (e.g., 3000)
EXPOSE $PORT
# Run the app in development mode with the original command style
CMD  export NODE_ENV=development && cd /app/ && pnpm install && cd /app/apps/participant-tma && pnpm install && pnpm dev --port $PARTICIPANT_TMA_PORT

# Build stage
FROM dependencies AS build
WORKDIR /app/apps/participant-tma
RUN echo "Build stage files " && ls -la
RUN pnpm run build

# Clean up unnecessary files to reduce image size
RUN rm -rf /app/apps/nft-manager \
          /app/apps/participant-tma/node_modules/env.mjs \
          /app/apps/participant-tma/app \
          /app/apps/participant-tma/store \
          /app/apps/participant-tma/utils \
          /app/apps/participant-tma/types \
          /app/apps/participant-tma/services \
          /app/apps/participant-tma/hooks \
          /app/apps/participant-tma/middleware.ts \
          /app/apps/participant-tma/components

# Production stage
FROM build AS production
# Port for participant-tma
EXPOSE $PORT
# Run the app in production mode with the original command style
CMD pnpm start --port $PARTICIPANT_TMA_PORT
