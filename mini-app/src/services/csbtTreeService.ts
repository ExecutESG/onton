import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { users } from "@/db/schema/users";
import { csbtTreesDB } from "@/db/modules/csbtTrees.db";
import { CsbtTreeRow } from "@/db/schema/csbtTrees";
import { minioClient, ensureBucketsExist } from "@/lib/minioClient";
import { CsbtMerkleTree, CsbtLeafData } from "@/lib/csbt";
import { logger } from "@/server/utils/logger";
import { and, asc, eq } from "drizzle-orm";

const CSBT_BUCKET = process.env.CSBT_MINIO_BUCKET || "csbt-trees";

export interface CsbtTreePayload {
  eventUuid: string;
  kind: "native" | "legacy";
  root: string;
  leafCount: number;
  frozenAt: string;
  leaves: CsbtLeafData[];
}

export const csbtTreeService = {
  /**
   * Returns the configured MinIO bucket for cSBT trees.
   */
  getBucket(): string {
    return CSBT_BUCKET;
  },

  /**
   * Uploads the full cSBT leaves payload JSON to MinIO.
   */
  async uploadPayloadToMinio(
    kind: "native" | "legacy",
    eventUuid: string,
    payload: CsbtTreePayload
  ): Promise<string> {
    const bucket = this.getBucket();
    await ensureBucketsExist([bucket]);

    const objectName = `events/${eventUuid}/${kind}.json`;
    const minioKey = `${bucket}/${objectName}`;
    const buffer = Buffer.from(JSON.stringify(payload));

    await minioClient.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": "application/json",
    });

    return minioKey;
  },

  /**
   * Retrieves and parses the leaves payload JSON from MinIO.
   */
  async loadPayloadFromMinio(minioKey: string): Promise<CsbtTreePayload> {
    const firstSlash = minioKey.indexOf("/");
    const bucket = firstSlash !== -1 ? minioKey.substring(0, firstSlash) : this.getBucket();
    const objectName = firstSlash !== -1 ? minioKey.substring(firstSlash + 1) : minioKey;

    const stream = await minioClient.getObject(bucket, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const content = Buffer.concat(chunks).toString("utf-8");
    const payload = JSON.parse(content) as CsbtTreePayload;

    return payload;
  },

  /**
   * Freezes an ended native event: builds Merkle tree from checked-in attendees,
   * uploads leaves payload to MinIO, and records the frozen tree in csbt_trees.
   */
  async freezeNativeEventTree(eventUuid: string): Promise<CsbtTreeRow> {
    // 1. Check if already frozen
    const existing = await csbtTreesDB.getCsbtTree(eventUuid, "native");
    if (existing) {
      return existing;
    }

    // 2. Fetch all checked-in registrants ordered by id ASC
    const registrants = await db
      .select({
        id: eventRegistrants.id,
        registrantUuid: eventRegistrants.registrant_uuid,
        userId: eventRegistrants.user_id,
        walletAddress: users.wallet_address,
      })
      .from(eventRegistrants)
      .leftJoin(users, eq(users.user_id, eventRegistrants.user_id))
      .where(
        and(
          eq(eventRegistrants.event_uuid, eventUuid),
          eq(eventRegistrants.status, "checkedin")
        )
      )
      .orderBy(asc(eventRegistrants.id));

    // 3. Build leaves
    const leaves: CsbtLeafData[] = registrants.map((reg, idx) => ({
      index: idx,
      ownerAddress: reg.walletAddress || String(reg.userId || 0),
      userId: reg.userId || undefined,
      eventUuid,
    }));

    // Fallback: If 0 checked-in, anchor a dummy zero leaf to guarantee valid root
    if (leaves.length === 0) {
      leaves.push({
        index: 0,
        ownerAddress: "0",
        eventUuid,
      });
    }

    // 4. Construct Merkle tree
    const tree = await CsbtMerkleTree.fromLeaves(leaves);
    const root = tree.getRootHex();
    const leafCount = leaves.length;
    const frozenAt = new Date();

    const payload: CsbtTreePayload = {
      eventUuid,
      kind: "native",
      root,
      leafCount,
      frozenAt: frozenAt.toISOString(),
      leaves,
    };

    // 5. Upload to MinIO
    const minioKey = await this.uploadPayloadToMinio("native", eventUuid, payload);

    // 6. Record in DB
    const row = await csbtTreesDB.insertCsbtTree({
      eventUuid,
      kind: "native",
      root,
      leafCount,
      minioKey,
      frozenAt,
    });

    logger.log(`csbtTreeService: Frozen native tree for event ${eventUuid}`, {
      root,
      leafCount,
      minioKey,
    });

    return row;
  },

  /**
   * Retrieves the authoritative frozen tree and reconstructed Merkle tree instance.
   */
  async getFrozenTree(eventUuid: string): Promise<{
    record: CsbtTreeRow;
    tree: CsbtMerkleTree;
    payload: CsbtTreePayload;
  } | null> {
    const record = await csbtTreesDB.getCsbtTreeByEvent(eventUuid);
    if (!record) {
      return null;
    }

    try {
      const payload = await this.loadPayloadFromMinio(record.minioKey);
      const tree = await CsbtMerkleTree.fromLeaves(payload.leaves);
      return { record, tree, payload };
    } catch (err) {
      logger.error(`csbtTreeService: Failed to load frozen tree payload for ${eventUuid}:`, err);
      return null;
    }
  },
};

export default csbtTreeService;
