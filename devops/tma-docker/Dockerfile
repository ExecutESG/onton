# Base image
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS build

# Build arguments to accept environment variables
ARG BOT_TOKEN
ARG ONTON_API_KEY
ARG NEXT_PUBLIC_BOT_USERNAME
ARG NEXT_PUBLIC_API_BASE_URL
ARG NFT_MANAGER_PORT
ARG PARTICIPANT_TMA_PORT
ARG MINI_APP_DOMAIN
ARG MINI_APP_PORT

# Export arguments as environment variables
ENV BOT_TOKEN=${BOT_TOKEN}
ENV ONTON_API_KEY=${ONTON_API_KEY}
ENV NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NFT_MANAGER_PORT=${NFT_MANAGER_PORT}
ENV PARTICIPANT_TMA_PORT=${PARTICIPANT_TMA_PORT}
ENV MINI_APP_DOMAIN=${MINI_APP_DOMAIN}
ENV MINI_APP_PORT=${MINI_APP_PORT}

# Copy workspace files and install dependencies
COPY ../../newton /usr/src/app
COPY ../../newton/pnpm-workspace.yaml /usr/src/app/pnpm-workspace.yaml
WORKDIR /usr/src/app

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the application
RUN pnpm run build

# Deploy the specific parts
RUN pnpm deploy --filter=nft-manager --prod /prod/nft-manager
RUN pnpm deploy --filter=participant-tma --prod /prod/participant-tma

# Participant-tma runtime stage
FROM base AS participant-tma
ARG PARTICIPANT_TMA_PORT
ENV PORT=${PARTICIPANT_TMA_PORT}
COPY --from=build /prod/participant-tma /prod/participant-tma
WORKDIR /prod/participant-tma
EXPOSE ${PARTICIPANT_TMA_PORT}

# Start the application
CMD node ./node_modules/next/dist/bin/next start --port $PARTICIPANT_TMA_PORT
