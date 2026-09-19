# Onton Platform: Manual Database Maintenance

This guide provides the verified patterns for manually dumping and downloading the production database, specifically using the **SSH Key** authentication method established in February 2026.

## 1. Verified Dump Pattern

When dumping the database from a remote container, avoid TTY allocation and ensure precise container selection to prevent OCI runtime errors.

### Direct SQL Dump (Gzipped)
Run this from your local machine (once SSH Keys are installed):

```bash
# 1. SSH in and run the dump (Handling multi-container collision with 'head -n 1')
ssh -i ~/.ssh/onton_prod_key root@65.109.212.86 \
"PG_CONTAINER=\$(docker ps -q -f name=postgres -f status=running | head -n 1) && \
docker exec -e PGPASSWORD="<PROD_POSTGRES_PASSWORD>" \$PG_CONTAINER pg_dumpall -c -U ontonont | gzip > /root/manual_dump.sql.gz"

# 2. Download the dump locally
scp -i ~/.ssh/onton_prod_key root@65.109.212.86:/root/manual_dump.sql.gz ./
```

## 2. Technical Requirements

- **User**: The production Postgres user is confirmed as `ontonont` (NOT `onton`).
- **Container Selection**: Filter by `name=postgres` and `status=running`. Always pipe to `head -n 1` to avoid OCI runtime errors caused by multiple matching container IDs.
- **Output Redirection**: Never use the `-t` (TTY) flag in `docker exec` when redirecting output to a file or pipe, as it injects control characters that corrupt gzipped streams.
- **Success Metric**: A healthy gzipped dump of the Onton platform as of Feb 2026 is approximately **2.6GB**.

## 3. Remote Verification

To verify the integrity of the dump on the server before downloading:

```bash
ssh -i ~/.ssh/onton_prod_key root@65.109.212.86 "ls -lh /root/manual_dump.sql.gz"
```
