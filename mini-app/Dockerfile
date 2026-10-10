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

# ARGS (Build-time public variables only)
ARG ENV
ARG NEXT_PUBLIC_ENV
ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_BOT_USERNAME
ARG NEXT_PUBLIC_SOCKET_URL
ARG MINI_APP_PORT=3000

# Export public arguments as environment variables for build time
ENV ENV=${ENV}
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}
ENV NEXT_PUBLIC_BOT_USERNAME=${NEXT_PUBLIC_BOT_USERNAME}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV MINI_APP_PORT=${MINI_APP_PORT}

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
