FROM node:22-alpine3.19 AS base
ARG PORT_WEB_SITE
ARG NEXT_PUBLIC_APP_BASE_URL
ARG MINI_APP_DOMAIN
ENV PORT_WEB_SITE=$PORT_WEB_SITE
ENV NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL
ENV MINI_APP_DOMAIN=$MINI_APP_DOMAIN
# Set the working directory inside the container
# Install necessary packages
RUN apk update && apk upgrade && \
  apk add \
  bash \
  curl \
  ca-certificates
# Install pnpm globally
RUN npm i -g pnpm@9.15.4
WORKDIR /app

FROM base AS dependencies
# Copy package.json and package-lock.json
COPY package*.json ./
# Install dependencies
RUN pnpm install

FROM dependencies AS with-files
# Copy the rest of the application code
COPY . .


FROM with-files AS build
# Build the application
RUN pnpm run build

FROM build AS production
# Expose the port on which the app runs
EXPOSE $PORT_WEB_SITE
# Start the application
CMD node ./node_modules/next/dist/bin/next start  --port   ${PORT_WEB_SITE:-3003}

FROM with-files AS development
# Expose the port on which the app runs
EXPOSE $PORT_WEB_SITE
# Start the application in development mode
CMD export NODE_ENV=development && node ./node_modules/next/dist/bin/next  dev    --port  ${PORT_WEB_SITE:-3003}
