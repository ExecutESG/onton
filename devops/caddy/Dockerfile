# Stage 1: Build Caddy with the Cloudflare DNS module
FROM caddy:builder AS builder
RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

# Stage 2: Copy the built Caddy binary to a new Caddy image
FROM caddy:latest AS production
COPY --from=builder /usr/bin/caddy /usr/bin/caddy


