import fs from "fs";
import path from "path";
import { z } from "zod";
import { db } from "../src/db/db";
import { sbtCollections } from "../src/db/schema/sbtCollections";
import { sbtItems } from "../src/db/schema/sbtItems";
import { CsbtMerkleTree, CsbtLeafData } from "../src/lib/csbt";
import { eq } from "drizzle-orm";

const AttendeeRecordSchema = z.object({
  wallet_address: z.string().min(1),
  user_id: z.union([z.number(), z.string()]).optional(),
  badge_title: z.string().optional(),
  badge_description: z.string().optional(),
  image_url: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type AttendeeRecord = z.infer<typeof AttendeeRecordSchema>;

export interface IngestionOptions {
  filePath: string;
  eventUuid: string;
  expectedRootHex?: string;
  dryRun?: boolean;
}

export interface IngestionResult {
  totalProcessed: number;
  computedRootHex: string;
  rootMatched: boolean;
  insertedCount: number;
  collectionId: number | null;
}

/**
 * Parses CSV or JSON attendee lists, computes deterministic Merkle root,
 * and bulk-imports historical cSBT credential records.
 */
export async function importCsbtHistory(options: IngestionOptions): Promise<IngestionResult> {
  const { filePath, eventUuid, expectedRootHex, dryRun = false } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, "utf-8").trim();
  let records: AttendeeRecord[] = [];

  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(rawContent);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    records = arr.map((item) => AttendeeRecordSchema.parse(item));
  } else if (filePath.endsWith(".csv")) {
    const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const walletIdx = header.indexOf("wallet_address") !== -1 ? header.indexOf("wallet_address") : header.indexOf("wallet");
    const userIdx = header.indexOf("user_id") !== -1 ? header.indexOf("user_id") : header.indexOf("telegram_id");
    const titleIdx = header.indexOf("badge_title") !== -1 ? header.indexOf("badge_title") : header.indexOf("title");

    if (walletIdx === -1) {
      throw new Error("CSV header missing required 'wallet_address' column");
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (!cols[walletIdx]) continue;
      records.push({
        wallet_address: cols[walletIdx],
        user_id: userIdx !== -1 && cols[userIdx] ? cols[userIdx] : undefined,
        badge_title: titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx] : undefined,
      });
    }
  } else {
    throw new Error("Unsupported file format. Please provide a .json or .csv file.");
  }

  if (records.length === 0) {
    throw new Error("No valid attendee records found in file");
  }

  // 1. Construct deterministic Merkle leaves
  const leaves: CsbtLeafData[] = records.map((rec, idx) => ({
    index: idx,
    ownerAddress: rec.wallet_address,
    eventUuid,
    metadata: {
      name: rec.badge_title || "Official Attendance SBT",
      description: rec.badge_description || "Historical Sovereign Proof of Attendance",
      image: rec.image_url || "https://onton.app/assets/sbt-badge.png",
      attributes: [{ trait_type: "Source", value: "Historical Import" }],
      ...rec.metadata,
    },
  }));

  const tree = await CsbtMerkleTree.fromLeaves(leaves);
  const computedRootHex = tree.getRootHex();

  let rootMatched = true;
  if (expectedRootHex) {
    rootMatched = computedRootHex.toLowerCase() === expectedRootHex.toLowerCase();
    if (!rootMatched) {
      throw new Error(
        `Merkle root mismatch! Computed: ${computedRootHex}, Expected: ${expectedRootHex}`
      );
    }
  }

  let collectionId: number | null = null;
  let insertedCount = 0;

  if (!dryRun) {
    // Look up or create sbtCollection row
    const existingCol = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.eventUuid, eventUuid))
      .limit(1);

    if (existingCol.length > 0) {
      collectionId = existingCol[0].id;
    } else {
      const [newCol] = await db
        .insert(sbtCollections)
        .values({
          eventUuid,
          collectionAddress: `EQ_HISTORICAL_${computedRootHex.slice(0, 16)}`,
          ownerAddress: "EQ_ONTON_TREASURY",
          authorityAddress: "EQ_ONTON_AUTHORITY",
          name: `Historical Collection for ${eventUuid.slice(0, 8)}`,
          metadataUrl: `ipfs://${computedRootHex}`,
          nextItemIndex: records.length,
          totalMinted: records.length,
          status: "active",
        })
        .returning({ id: sbtCollections.id });
      collectionId = newCol.id;
    }

    // Insert batch into sbt_items
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const rec = records[i];
      await db.insert(sbtItems).values({
        sbtCollectionId: collectionId!,
        itemIndex: leaf.index,
        itemAddress: `EQ_SBT_${computedRootHex.slice(0, 8)}_${leaf.index}`,
        recipientUserId: rec.user_id ? Number(rec.user_id) : null,
        recipientWalletAddress: leaf.ownerAddress,
        metadataUrl: `ipfs://${computedRootHex}/${leaf.index}`,
        status: "minted",
        metadata: leaf.metadata as any,
      });
      insertedCount++;
    }
  }

  return {
    totalProcessed: records.length,
    computedRootHex,
    rootMatched,
    insertedCount,
    collectionId,
  };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const eventArg = args.find((a) => a.startsWith("--event="))?.split("=")[1];
  const rootArg = args.find((a) => a.startsWith("--expected-root="))?.split("=")[1];
  const isDryRun = args.includes("--dry-run");

  if (!fileArg || !eventArg) {
    console.error("Usage: tsx scripts/import-csbt-history.ts --file=<path.csv|.json> --event=<uuid> [--expected-root=<hex>] [--dry-run]");
    process.exit(1);
  }

  importCsbtHistory({
    filePath: path.resolve(process.cwd(), fileArg),
    eventUuid: eventArg,
    expectedRootHex: rootArg,
    dryRun: isDryRun,
  })
    .then((res) => {
      console.log("Ingestion successfully completed:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Ingestion failed:", err);
      process.exit(1);
    });
}
