import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { sbtCollections } from "@/db/schema/sbtCollections";
import { users } from "@/db/schema/users";
import eventDB from "@/db/modules/events.db";
import { and, asc, eq } from "drizzle-orm";
import { CsbtMerkleTree, CsbtLeafData, serializeProofToCell } from "@/lib/csbt";
import { csbtTreeService } from "@/services/csbtTreeService";
import { getCache, setCache } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

export const dynamic = "force-dynamic";

/** Short-lived cache TTL for live (unfrozen) Merkle trees (60 seconds). */
const LIVE_TREE_CACHE_TTL_SEC = 60;

/**
 * @swagger
 * /api/v1/csbt/proof:
 *   get:
 *     summary: Sovereign Compressed SBT (cSBT) Merkle Proof API
 *     description: Retrieves the cryptographic Merkle proof and serialized TON Cell BoC for an attendee's soulbound badge. Serves from frozen persisted trees or live Redis-cached trees. Requires caller to match a verified attendee leaf.
 *     parameters:
 *       - in: query
 *         name: eventUuid
 *         schema:
 *           type: string
 *         description: Event UUID
 *       - in: query
 *         name: collectionAddress
 *         schema:
 *           type: string
 *         description: On-chain SBT collection or anchor contract address
 *       - in: query
 *         name: walletAddress
 *         schema:
 *           type: string
 *         description: Attendee's TON wallet address
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Attendee's Telegram user ID
 *       - in: query
 *         name: leafIndex
 *         schema:
 *           type: integer
 *         description: Optional direct leaf index (must match requester's own leaf)
 *     responses:
 *       200:
 *         description: Cryptographic proof and BoC cell
 *       404:
 *         description: Event not found or requester is not a verified attendee (not_a_member)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let eventUuid = searchParams.get("eventUuid");
    const collectionAddress = searchParams.get("collectionAddress");
    const walletAddress = searchParams.get("walletAddress")?.trim();
    const userIdStr = searchParams.get("userId");
    const leafIndexParam = searchParams.get("leafIndex");

    // 1. Resolve event UUID
    if (!eventUuid && collectionAddress) {
      const colRows = await db
        .select()
        .from(sbtCollections)
        .where(eq(sbtCollections.collectionAddress, collectionAddress))
        .limit(1);
      if (colRows.length > 0) {
        eventUuid = colRows[0].eventUuid;
      }
    }

    if (!eventUuid) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: eventUuid or valid collectionAddress" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // 2. Fetch event details
    const event = await eventDB.fetchEventByUuid(eventUuid);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    const userId = userIdStr ? parseInt(userIdStr, 10) : undefined;

    // Requester must provide userId or walletAddress to prove membership
    if (!userId && !walletAddress) {
      return NextResponse.json(
        { success: false, error: "not_a_member" },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 3. Check for frozen persisted tree (MinIO)
    const frozen = await csbtTreeService.getFrozenTree(eventUuid);

    if (frozen) {
      const { record, tree, payload } = frozen;
      const leaves = payload.leaves;

      if (!leaves || leaves.length === 0) {
        return NextResponse.json(
          { success: false, error: "not_a_member" },
          { status: 404, headers: corsHeaders() }
        );
      }

      let matchIdx = -1;
      if (userId) {
        matchIdx = leaves.findIndex(
          (l) => l.userId === userId || l.ownerAddress === String(userId)
        );
      }
      if (matchIdx === -1 && walletAddress) {
        const normWallet = walletAddress.toLowerCase();
        matchIdx = leaves.findIndex((l) => l.ownerAddress?.toLowerCase() === normWallet);
      }

      // Requester does not match any leaf in the frozen tree
      if (matchIdx === -1) {
        return NextResponse.json(
          { success: false, error: "not_a_member" },
          { status: 404, headers: corsHeaders() }
        );
      }

      // If leafIndexParam was provided, verify it strictly matches requester's own leaf
      if (leafIndexParam !== null) {
        const parsedIdx = parseInt(leafIndexParam, 10);
        if (isNaN(parsedIdx) || parsedIdx !== matchIdx) {
          return NextResponse.json(
            { success: false, error: "not_a_member" },
            { status: 404, headers: corsHeaders() }
          );
        }
      }

      const targetIndex = matchIdx;
      const targetLeaf = leaves[targetIndex];

      const proof = tree.getProof(targetIndex);
      const proofCell = serializeProofToCell(proof.steps);
      const proofCellBoc = proofCell.toBoc().toString("base64");
      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);

      return NextResponse.json(
        {
          success: true,
          eventUuid,
          kind: record.kind,
          isFrozen: true,
          anchored: Boolean(record.anchoredAt),
          anchorTxHash: record.anchorTxHash || null,
          anchoredAt: record.anchoredAt || null,
          frozenAt: record.frozenAt,
          collectionAddress: collectionAddress || event.sbt_collection_address || null,
          merkleRootHex: record.root,
          totalLeaves: payload.leafCount,
          leafIndex: targetIndex,
          leafHashHex: proof.leafHashHex,
          proofCellBoc,
          proofStepsCount: proof.steps.length,
          proofValid: isVerified,
          verified: isVerified,
          isMember: true,
          metadata: {
            title: event.title,
            description: event.description || `Soulbound Proof of Attendance for ${event.title}`,
            image: event.tsRewardImage || event.image_url || "https://onton.app/assets/sbt-badge.png",
            ownerIdentifier: targetLeaf.ownerAddress,
            eventStartDate: event.start_date,
            eventEndDate: event.end_date,
          },
        },
        { headers: corsHeaders() }
      );
    }

    // 4. Live events: build dynamic tree with short-lived Redis caching
    const checkedIn = await db
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

    if (checkedIn.length === 0) {
      return NextResponse.json(
        { success: false, error: "not_a_member" },
        { status: 404, headers: corsHeaders() }
      );
    }

    let matchIdx = -1;
    if (userId) {
      matchIdx = checkedIn.findIndex((r) => r.userId === userId);
    }
    if (matchIdx === -1 && walletAddress) {
      const normWallet = walletAddress.toLowerCase();
      matchIdx = checkedIn.findIndex((r) => r.walletAddress?.toLowerCase() === normWallet);
    }

    if (matchIdx === -1) {
      return NextResponse.json(
        { success: false, error: "not_a_member" },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (leafIndexParam !== null) {
      const parsedIdx = parseInt(leafIndexParam, 10);
      if (isNaN(parsedIdx) || parsedIdx !== matchIdx) {
        return NextResponse.json(
          { success: false, error: "not_a_member" },
          { status: 404, headers: corsHeaders() }
        );
      }
    }

    const targetIndex = matchIdx;
    const cacheKey = `csbt:live_tree:${eventUuid}:${checkedIn.length}`;

    let tree: CsbtMerkleTree;
    let leaves: CsbtLeafData[];

    const cached = await getCache(cacheKey);
    if (cached && Array.isArray(cached.leaves) && Array.isArray(cached.leafHashesHex)) {
      leaves = cached.leaves;
      const leafHashes = cached.leafHashesHex.map((h: string) => Buffer.from(h, "hex"));
      tree = new CsbtMerkleTree(leafHashes);
    } else {
      leaves = checkedIn.map((reg, idx) => ({
        index: idx,
        ownerAddress: reg.walletAddress || String(reg.userId || 0),
        userId: reg.userId || undefined,
        eventUuid: eventUuid!,
      }));
      tree = await CsbtMerkleTree.fromLeaves(leaves);

      const leafHashesHex = leaves.map((_, i) => tree.getProof(i).leafHashHex);
      await setCache(cacheKey, { leaves, leafHashesHex }, LIVE_TREE_CACHE_TTL_SEC);
    }

    const targetLeaf = leaves[targetIndex];
    const proof = tree.getProof(targetIndex);
    const proofCell = serializeProofToCell(proof.steps);
    const proofCellBoc = proofCell.toBoc().toString("base64");
    const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);

    return NextResponse.json(
      {
        success: true,
        eventUuid,
        kind: "native",
        isFrozen: false,
        anchored: false,
        anchorTxHash: null,
        anchoredAt: null,
        frozenAt: null,
        collectionAddress: collectionAddress || event.sbt_collection_address || null,
        merkleRootHex: tree.getRootHex(),
        totalLeaves: leaves.length,
        leafIndex: targetIndex,
        leafHashHex: proof.leafHashHex,
        proofCellBoc,
        proofStepsCount: proof.steps.length,
        proofValid: isVerified,
        verified: isVerified,
        isMember: true,
        metadata: {
          title: event.title,
          description: event.description || `Soulbound Proof of Attendance for ${event.title}`,
          image: event.tsRewardImage || event.image_url || "https://onton.app/assets/sbt-badge.png",
          ownerIdentifier: targetLeaf.ownerAddress,
          eventStartDate: event.start_date,
          eventEndDate: event.end_date,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (err: any) {
    logger.error("CSBT::Proof::Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
