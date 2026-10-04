/**
 * One-time script: buildLegacyCsbtTrees.ts
 *
 * Builds one legacy cSBT tree per event from legacy `rewards` and `visitors` tables.
 * Total scale: ~1,699 events, ~13M leaves.
 *
 * Guarantees:
 * - Read-only on source tables (`rewards`, `visitors`, `events`).
 * - Defaults to --dry-run (no database writes or MinIO uploads without --apply).
 * - Batched and resumable (skips events already recorded in `csbt_trees` with kind = 'legacy').
 * - Strictly guarded against accidental execution on staging or production.
 *
 * Usage:
 *   yarn tsx scripts/buildLegacyCsbtTrees.ts                     # Dry run (default)
 *   yarn tsx scripts/buildLegacyCsbtTrees.ts --batch-size 20     # Custom batch size
 *   yarn tsx scripts/buildLegacyCsbtTrees.ts --apply             # Write to MinIO and csbt_trees locally
 */

import { db } from "@/db/db";
import { visitors } from "@/db/schema/visitors";
import { csbtTrees } from "@/db/schema/csbtTrees";
import { csbtTreesDB } from "@/db/modules/csbtTrees.db";
import { csbtTreeService, CsbtTreePayload } from "@/services/csbtTreeService";
import { CsbtMerkleTree, CsbtLeafData } from "@/lib/csbt";
import { is_prod_env, is_stage_env } from "@/server/utils/evnutils";
import { asc, eq, sql } from "drizzle-orm";

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply") || args.includes("--commit");
  const isDryRun = !isApply;

  console.log("==================================================================");
  console.log("ONTON cSBT Legacy Tree Aggregator");
  console.log(`Mode: ${isDryRun ? "DRY-RUN (default, no writes)" : "APPLY (writing to MinIO & csbt_trees)"}`);
  console.log("==================================================================");

  // Safety guard: NEVER run on staging or prod without Mahdi's explicit approval
  if (
    is_prod_env() ||
    is_stage_env() ||
    process.env.ENV === "production" ||
    process.env.ENV === "staging"
  ) {
    if (!args.includes("--force-prod-approval")) {
      console.error(
        "\n[SAFETY BLOCKED]: Running legacy tree builder against staging/prod is strictly forbidden without Mahdi's approval."
      );
      process.exit(1);
    }
  }

  // Parse batch size / limit
  let batchSize = 50;
  const batchSizeIdx = args.indexOf("--batch-size");
  if (batchSizeIdx !== -1 && args[batchSizeIdx + 1]) {
    batchSize = parseInt(args[batchSizeIdx + 1], 10);
  }

  let limit: number | undefined;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  // 1. Query candidate events from visitors that lack a legacy tree (resumable)
  console.log("Scanning for unbuilt legacy events in visitors table...");
  const candidateRows = await db
    .select({
      eventUuid: visitors.event_uuid,
    })
    .from(visitors)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${csbtTrees}
        WHERE ${csbtTrees.eventUuid} = ${visitors.event_uuid}
          AND ${csbtTrees.kind} = 'legacy'
      )`
    )
    .groupBy(visitors.event_uuid)
    .limit(limit || 10000);

  console.log(`Found ${candidateRows.length} events needing legacy cSBT trees.`);
  if (candidateRows.length === 0) {
    console.log("All legacy events already have cSBT trees! Nothing to do.");
    return;
  }

  let processedCount = 0;
  let totalLeavesAggregated = 0;

  for (let i = 0; i < candidateRows.length; i += batchSize) {
    const batch = candidateRows.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} (${batch.length} events)...`);

    for (const item of batch) {
      const eventUuid = item.eventUuid;

      // Read-only query for attendee visitor records
      const attendees = await db
        .select({
          id: visitors.id,
          userId: visitors.user_id,
        })
        .from(visitors)
        .where(eq(visitors.event_uuid, eventUuid))
        .orderBy(asc(visitors.id));

      if (attendees.length === 0) {
        continue;
      }

      const leaves: CsbtLeafData[] = attendees.map((att, idx) => ({
        index: idx,
        ownerAddress: String(att.userId || 0),
        userId: att.userId ? Number(att.userId) : undefined,
        eventUuid,
      }));

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      const rootHex = tree.getRootHex();
      const leafCount = leaves.length;

      totalLeavesAggregated += leafCount;
      processedCount++;

      if (isDryRun) {
        console.log(
          `[DRY-RUN] Event ${eventUuid}: ${leafCount} leaves, root = ${rootHex}`
        );
      } else {
        const payload: CsbtTreePayload = {
          eventUuid,
          kind: "legacy",
          root: rootHex,
          leafCount,
          frozenAt: new Date().toISOString(),
          leaves,
        };

        const minioKey = await csbtTreeService.uploadPayloadToMinio("legacy", eventUuid, payload);

        await csbtTreesDB.insertCsbtTree({
          eventUuid,
          kind: "legacy",
          root: rootHex,
          leafCount,
          minioKey,
          frozenAt: new Date(),
        });

        console.log(
          `[APPLIED] Event ${eventUuid}: ${leafCount} leaves, root = ${rootHex}, minio = ${minioKey}`
        );
      }
    }
  }

  console.log("\n==================================================================");
  console.log("Summary:");
  console.log(`- Events processed: ${processedCount}`);
  console.log(`- Total leaves aggregated: ${totalLeavesAggregated}`);
  console.log(`- Mode: ${isDryRun ? "DRY RUN (no database or MinIO changes made)" : "APPLIED"}`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("buildLegacyCsbtTrees error:", err);
  process.exit(1);
});
