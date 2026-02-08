#!/bin/sh
set -e
# Define TLS configuration based on the USE_CLOUDFLARE variable
echo "Generating Caddyfile... ${USE_CLOUDFLARE}"
if [ -n "${USE_CLOUDFLARE}" ]; then
    TLS_CONFIG="tls {
        dns cloudflare  {env.CLOUDFLARE_API_TOKEN}
        protocols tls1.2 tls1.3
    }"
else
    TLS_CONFIG="tls /certs/fullchain.pem /certs/privkey.pem {
        protocols tls1.2 tls1.3
    }"
fi

# Set the IP for services based on the USE_MAIN_IP_TO_EXPOSE variable
if [ "${USE_MAIN_IP_TO_EXPOSE}" = "true" ]; then
    PROXY_MINI_APP='host.docker.internal'
    PROXY_PARTICIPANT_TMA='host.docker.internal'
    PROXY_METABASE='host.docker.internal'
    PROXY_MINIO='host.docker.internal'
    PROXY_PGADMIN='host.docker.internal'
    PROXY_CLIENT_WEB='host.docker.internal'
    PROXY_WEBSITE='host.docker.internal'
    PROXY_RABBITMQ='host.docker.internal'
    PROXY_SOCKET='host.docker.internal'
    PROXY_KIBANA='host.docker.internal'
    PROXY_SWAGGER_UI='host.docker.internal'
else
    PROXY_MINI_APP=${IP_MINI_APP}
    PROXY_PARTICIPANT_TMA=${IP_PARTICIPANT_TMA}
    PROXY_METABASE=${IP_METABASE}
    PROXY_MINIO=${IP_MINIO}
    PROXY_PGADMIN=${IP_PGADMIN}
    PROXY_CLIENT_WEB=${IP_CLIENT_WEB}
    PROXY_WEBSITE=${IP_WEBSITE}
    PROXY_RABBITMQ=${IP_RABBITMQ}
    PROXY_SOCKET=${IP_SOCKET}
    PROXY_KIBANA=${IP_KIBANA}
    PROXY_SWAGGER_UI=${IP_SWAGGER_UI}
fi

# Define log configuration
LOG_CONFIG="log {
    output stdout
    format json
}"

# Generate Caddyfile
echo "

${MINI_APP_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy /ptma* http://${PROXY_PARTICIPANT_TMA}:${PARTICIPANT_TMA_PORT}
    reverse_proxy /swagger* http://${PROXY_SWAGGER_UI}:${SWAGGER_UI_PORT}
    reverse_proxy http://${PROXY_MINI_APP}:${MINI_APP_PORT}
}

${MINI_APP_SOCKET_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy /socket.io/*  http://${PROXY_SOCKET}:${SOCKET_PORT} {
                                                                header_up Host {http.reverse_proxy.upstream.hostport}
                                                                transport http {
                                                                    read_buffer 65535
                                                                    write_buffer 65535
                                                                }
                                                            }
}

${SWAGGER_UI_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy http://${PROXY_SWAGGER_UI}:${SWAGGER_UI_PORT}
}

${METABASE_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy ${PROXY_METABASE}:${PORT_METABASE}
}

${MINIO_STORAGE_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy http://${PROXY_MINIO}:${MINIO_PORT}
}

${RABBITMQ_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy http://${PROXY_RABBITMQ}:${RABBITMQ_MANAGEMENT_PORT}
}

${MINIO_STORAGE_ADMIN_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy http://${PROXY_MINIO}:${MINIO_DASHBOARD_PORT}
}



${PGADMIN_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy http://${PROXY_PGADMIN}:${PORT_PGADMIN} {
       header_up X-Forwarded-Proto {scheme}
       header_up Host {host}
       header_down -X-Content-Type-Options
    }
}

${CLIENT_WEB_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}

    reverse_proxy ${PROXY_CLIENT_WEB}:${PORT_CLIENT_WEB}
}

${ONTON_DOMAIN} {
    ${TLS_CONFIG}
    ${LOG_CONFIG}
    reverse_proxy ${PROXY_WEBSITE}:${PORT_WEB_SITE}
}

" > /etc/caddy/Caddyfile
cat /etc/caddy/Caddyfile
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
