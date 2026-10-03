# Onton Platform: Manual Database Maintenance

> Last verified against dev: 2026-10-03

How to dump and download the production database by hand.

> [!IMPORTANT]
> There are no automated production DB backups. This manual dump is the only backup path today. Take one before every migration or risky deploy.

## 1. Dump pattern

Production: `65.109.212.86`, plain `docker compose` project `local-onton`. Take the Postgres user and password from the server `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`). Never paste them into docs or scripts in the repo.

```bash
# 1. Dump on the server (no -t; pick exactly one container)
ssh root@65.109.212.86 \
"PG_CONTAINER=\$(docker ps -q -f name=postgres -f status=running | head -n 1) && \
docker exec \$PG_CONTAINER pg_dumpall -c -U <POSTGRES_USER> | gzip > /root/manual_dump.sql.gz"

# 2. Download
scp root@65.109.212.86:/root/manual_dump.sql.gz ./
```

Use your own SSH key; password logins should not be scripted.

## 2. Rules
- **Container selection**: filter by `name=postgres` and `status=running`, and pipe to `head -n 1`. Otherwise several IDs can match (e.g. pgAdmin) and `docker exec` fails with "executable file not found".
- **No TTY**: never use `docker exec -t` when redirecting to a file or pipe. It corrupts the stream.
- **Empty dump**: a file of a few hundred bytes means the dump failed (wrong user, no permission, or TTY). Redirect stderr to a file to see the error.
- `./data/db_data` on the server is the live Postgres data directory, not a backup.

## 3. Verify before downloading

```bash
ssh root@65.109.212.86 "ls -lh /root/manual_dump.sql.gz && gunzip -t /root/manual_dump.sql.gz"
```

Compare the size with the previous dump. A large drop means something is wrong.

## 4. Restore
See Phase 4 in [migration_and_syncing.md](./migration_and_syncing.md).
