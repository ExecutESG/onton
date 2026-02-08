# ------------------------------------------------------
# 1) Base image
# ------------------------------------------------------
FROM node:22-alpine3.19 AS base

# Build arguments
ARG TELEGRAM_BOT_PORT
ENV TELEGRAM_BOT_PORT=${TELEGRAM_BOT_PORT}

RUN apk update && apk add --no-cache \
    bash \
    curl \
    ca-certificates \
    ffmpeg \
    freetype \
    ttf-dejavu \
    nano

# Install Yarn globally
#RUN npm install -g yarn

# Set the working directory
WORKDIR /app

# ------------------------------------------------------
# 2) Dependencies stage
# ------------------------------------------------------
FROM base AS dependencies

# Copy only the files needed to install dependencies
COPY package.json  ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# ------------------------------------------------------
# 3) Stage with all project files
# ------------------------------------------------------
FROM dependencies AS with-files

# Copy the entire project after dependencies are installed
COPY . .

# ------------------------------------------------------
# 4) Production stage
# ------------------------------------------------------
FROM with-files AS production

# Expose the default port for the telegram-bot
EXPOSE $TELEGRAM_BOT_PORT

# For production, we assume you have a build step (if TypeScript):
# e.g. RUN yarn build
# Then run the compiled files:
CMD ["yarn", "start"]

# ------------------------------------------------------
# 5) Development stage
# ------------------------------------------------------
FROM base AS development

# Copy the entire project for dev
COPY . .

# Expose the default port for dev
EXPOSE $TELEGRAM_BOT_PORT

# For dev mode, you might run a dev script
CMD ["bash", "-c", "export NODE_ENV=development && yarn install && yarn dev:server"]
