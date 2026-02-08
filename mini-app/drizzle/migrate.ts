#!/usr/bin/env bun
/**
 * Migration script using Bun and postgres.
 *
 * Usage:
 *   bun migrate.ts <number-of-migrations>
 *
 * Requirements:
 *   - DATABASE_URL environment variable set to a Postgres connection string.
 *   - A directory named "migrations" at the project root containing SQL files prefixed with a numeric identifier and underscore, e.g. "0001_description.sql".
 *   - Install the postgres driver: `bun add postgres`
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: bun migrate.ts <number-of-migrations>");
    process.exit(1);
  }
  const max = parseInt(args[0], 10);
  if (isNaN(max) || max < 1) {
    console.error("Invalid migration number:", args[0]);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL environment variable.");
    process.exit(1);
  }
  const sql = postgres(url);
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const appliedRows = await sql.unsafe(`SELECT name FROM migrations`);
    const applied = new Set(appliedRows.map((r) => r.name));

    // Read and sort migration files (drizzle style: numeric prefix and underscore)
    const migrationsDir = path.resolve(process.cwd(), "drizzle");
    let files;
    try {
      files = fs.readdirSync(migrationsDir);
    } catch (err) {
      console.error(`Failed to read migrations directory: ${migrationsDir}`, err);
      process.exit(1);
    }
    const migrationFiles = files.filter((f) => /^\d+_.*\.sql$/.test(f)).sort();

    if (migrationFiles.length === 0) {
      console.error(`No migration files found in ${migrationsDir}`);
      process.exit(1);
    }

    if (max > migrationFiles.length) {
      console.error(`Requested ${max} migrations, but only ${migrationFiles.length} file(s) found.`);
      process.exit(1);
    }

    for (let index = 0; index < max; index++) {
      const fileName = migrationFiles[index];
      const filePath = path.resolve(migrationsDir, fileName);
      if (applied.has(fileName)) {
        console.log(`Skipping already applied: ${fileName}`);
        continue;
      }
      const sqlContent = fs.readFileSync(filePath, "utf8");
      console.log(`Applying migration ${fileName}...`);
      try {
        await sql.begin(async () => {
          await sql.unsafe(sqlContent);
          await sql.unsafe(`INSERT INTO migrations (name) VALUES ($1)`, [fileName]);
        });
      } catch (err) {
        // eslint-disable-next-line
        // @ts-expect-error
        console.error(`Failed to apply ${fileName}:`, err?.message || err);
      }
      console.log(`Applied: ${fileName}`);
    }
    console.log("Migrations completed.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
