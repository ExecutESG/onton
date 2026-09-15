#!/bin/bash
set -euo pipefail

CADDYFILE="/home/tonont/dev/Caddyfile"

if [ ! -f "$CADDYFILE" ]; then
    echo "Error: $CADDYFILE not found!"
    exit 1
fi

echo "=== Current Caddyfile configuration ==="
grep -n "onton.live" "$CADDYFILE" || true

if grep -q "app.onton.live" "$CADDYFILE"; then
    echo "app.onton.live is already configured in $CADDYFILE"
else
    echo "Adding app.onton.live and onton.live reverse proxy blocks..."
    cat << 'CADDY_EOF' >> "$CADDYFILE"

app.onton.live {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
        protocols tls1.2 tls1.3
    }
    log {
        output stdout
        format json
    }
    reverse_proxy /ptma* http://host.docker.internal:8001
    reverse_proxy http://host.docker.internal:8000
}

onton.live, www.onton.live {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
        protocols tls1.2 tls1.3
    }
    log {
        output stdout
        format json
    }
    reverse_proxy http://host.docker.internal:8005
}
CADDY_EOF
    echo "Successfully appended blocks to $CADDYFILE."
fi

CADDY_CONTAINER=$(docker ps -q -f name=caddy | head -n 1)
if [ -z "$CADDY_CONTAINER" ]; then
    echo "Error: Caddy container not found!"
    exit 1
fi

echo "Validating and reloading Caddy in container $CADDY_CONTAINER..."
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile

echo "Testing Caddy response for app.onton.live on port 80..."
curl -sI -H "Host: app.onton.live" http://127.0.0.1:80/ | head -n 10
