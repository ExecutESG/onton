import fs from "fs";
import path from "path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const DRIZZLE_DIR = path.resolve(__dirname, "../drizzle");

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "--status";

  // Ensure tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS "_schema_migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    );
  `;

  // Read all sql files
  const files = fs
    .readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const rows = await sql<{ name: string }[]>`SELECT name FROM "_schema_migrations"`;
  const appliedSet = new Set(rows.map((r) => r.name));

  if (mode === "--baseline") {
    const target = args[1] || "0136";
    console.log(`Setting baseline up to prefix ${target}...`);
    for (const f of files) {
      const prefix = f.split("_")[0];
      if (prefix <= target && !appliedSet.has(f)) {
        await sql`INSERT INTO "_schema_migrations" (name) VALUES (${f}) ON CONFLICT DO NOTHING`;
        console.log(`  Marked as baseline: ${f}`);
      }
    }
    console.log("✅ Baseline complete.");
    await sql.end();
    return;
  }

  if (mode === "--status" || mode === "--check") {
    let pendingCount = 0;
    for (const f of files) {
      if (!appliedSet.has(f)) {
        console.log(`  [PENDING] ${f}`);
        pendingCount++;
      }
    }
    if (pendingCount === 0) {
      console.log(`✅ All ${files.length} migrations applied.`);
      await sql.end();
      return;
    } else {
      console.log(`⚠️ ${pendingCount} pending migration(s) found!`);
      await sql.end();
      if (mode === "--check") {
        process.exit(1);
      }
      return;
    }
  }

  if (mode === "--apply") {
    const pending = files.filter((f) => !appliedSet.has(f));
    if (pending.length === 0) {
      console.log("✅ Database is up to date. No pending migrations.");
      await sql.end();
      return;
    }

    console.log(`Applying ${pending.length} pending migration(s)...`);
    for (const f of pending) {
      const filePath = path.join(DRIZZLE_DIR, f);
      const content = fs.readFileSync(filePath, "utf-8");
      console.log(`--> Applying ${f}...`);
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO "_schema_migrations" (name) VALUES (${f})`;
      });
      console.log(`  ✅ Applied ${f}`);
    }
    console.log("✅ All pending migrations successfully applied.");
    await sql.end();
    return;
  }

  console.log("Usage: tsx scripts/migrate.ts [--status | --check | --baseline <prefix> | --apply]");
  await sql.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
