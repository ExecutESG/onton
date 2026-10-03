# Onton Platform: Migrations & Environment Syncing

> Last verified against dev: 2026-10-03

Two topics: (1) applying DB schema migrations, (2) copying production data to another server.

## 1. Applying schema migrations

> [!CAUTION]
> Never run `yarn db:migrate`. It runs drizzle `migrate()` against `mini-app/drizzle/` using `meta/_journal.json`, and that journal is stale.

Facts about `mini-app/drizzle/`:
- SQL files are numbered (latest: `0127_add_has_web3_to_events.sql`).
- The journal has fewer entries than there are SQL files. Some files are not in it (e.g. `0118`–`0120`, and extra `0002`/`0005`/`0073` files). Snapshots stop at `0117`.
- `yarn db:gen` = `drizzle-kit generate`. `yarn db:up` = `drizzle-kit up` (snapshot upgrade, **not** a migration).
- `mini-app/drizzle/migrate.ts` is a separate Bun script with its own table. No package script uses it.
- No migration runs in the Docker image; production starts with `next start`.

Procedure: apply each new SQL file by hand, in order, and stop on the first error.

```bash
# On the target host, from the compose project directory
cat mini-app/drizzle/<NNNN_name>.sql | \
  docker exec -i ${ENV}-postgres psql -v ON_ERROR_STOP=1 -U <POSTGRES_USER> -d <POSTGRES_MINI_APP_DB>
```

- Take a dump first ([manual_db_maintenance.md](./manual_db_maintenance.md)).
- Take user and DB names from the server `.env` (`POSTGRES_USER`, `POSTGRES_MINI_APP_DB`).

## 2. Copying production to another server

### Prerequisites (target)
- Linux with Docker, Docker Compose, `git`, `tar`.
- SSH access and ports 80/443 open.

### Phase 1: Snapshot on production (`65.109.212.86`, compose project `local-onton`)

Option A — cold (consistent): stop the workers first.
```bash
docker compose --profile full stop mini-app-sbt-worker mini-app-payment-worker \
  mini-app-reward-worker mini-app-ordinary-worker mini-app-poa-worker
```
Check exact service names with `docker compose --profile full config --services`.

Option B — hot (no downtime): skip the stop. Postgres dumps are consistent; files changed during `tar` may not be.

Then:
```bash
PG_CONTAINER=$(docker ps -q -f name=postgres -f status=running | head -n 1)
docker exec $PG_CONTAINER pg_dumpall -c -U <POSTGRES_USER> > production_full_dump.sql
tar -czf onton_data_snapshot.tar.gz ./data
```
Do not use `docker exec -t` when redirecting output.

### Phase 2: Code on the target
```bash
git clone https://github.com/ExecutESG/onton.git /root/ontonbot
```
Copy `.env` from production, then change domains, `NETWORK_PUBLIC_IP` and bot token. Rotate secrets for isolation (see [project_ownership_and_recovery.md](./project_ownership_and_recovery.md)). Never point a non-prod copy at `@theontonbot`.

### Phase 3: Transfer
```bash
scp production_full_dump.sql onton_data_snapshot.tar.gz root@<TARGET_IP>:/tmp/
```

### Phase 4: Restore
```bash
cd /root/ontonbot
docker compose --profile full up -d postgres redis minio
cat /tmp/production_full_dump.sql | docker exec -i ${ENV}-postgres psql -U <POSTGRES_USER>
tar -xzf /tmp/onton_data_snapshot.tar.gz -C /root/ontonbot/
docker compose --profile full up -d
```
Note: `./data/db_data` is the Postgres data directory. If you restore from the SQL dump, do not also overwrite a running `db_data` from the tarball.

## 3. Verify
- Mini App and website load on the target domain.
- Latest events and users exist in the DB.
- Images load from MinIO.
- The bot responds (with the target's own token).

## 4. Troubleshooting
- Nothing starts: you omitted `--profile full`.
- Permission errors on restored files: check ownership of `./data`.
- Wrong container: Postgres containers are named `${ENV}-postgres`; filter precisely and use `head -n 1`.
