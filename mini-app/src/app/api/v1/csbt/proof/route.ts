import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { sbtCollections } from "@/db/schema/sbtCollections";
import { users } from "@/db/schema/users";
import eventDB from "@/db/modules/events.db";
import { and, asc, eq } from "drizzle-orm";
import { CsbtMerkleTree, CsbtLeafData, serializeProofToCell } from "@/lib/csbt";
import { csbtTreeService } from "@/services/csbtTreeService";
import { logger } from "@/server/utils/logger";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/v1/csbt/proof:
 *   get:
 *     summary: Sovereign Compressed SBT (cSBT) Merkle Proof API
 *     description: Retrieves the cryptographic Merkle proof and serialized TON Cell BoC for an attendee's soulbound badge. Serves from frozen persisted trees when available.
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
 *         description: Optional direct leaf index
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

    // 3. Check for frozen persisted tree (MinIO)
    const frozen = await csbtTreeService.getFrozenTree(eventUuid);

    if (frozen) {
      const { record, tree, payload } = frozen;
      const leaves = payload.leaves;

      let targetIndex = 0;
      if (leafIndexParam !== null) {
        targetIndex = parseInt(leafIndexParam, 10);
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= leaves.length) {
          targetIndex = 0;
        }
      } else if (userId) {
        const matchIdx = leaves.findIndex(
          (l) => l.userId === userId || l.ownerAddress === String(userId)
        );
        if (matchIdx !== -1) targetIndex = matchIdx;
      } else if (walletAddress) {
        const matchIdx = leaves.findIndex((l) => l.ownerAddress === walletAddress);
        if (matchIdx !== -1) targetIndex = matchIdx;
      }

      const targetLeaf = leaves[targetIndex] || {
        index: 0,
        ownerAddress: walletAddress || String(userId || 0),
        eventUuid,
      };

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
          verified: isVerified,
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

    // 4. Live events: build dynamic per-request tree with anchored: false
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

    const leaves: CsbtLeafData[] = checkedIn.map((reg, idx) => ({
      index: idx,
      ownerAddress: reg.walletAddress || String(reg.userId || 0),
      userId: reg.userId || undefined,
      eventUuid: eventUuid!,
    }));

    if (leaves.length === 0) {
      leaves.push({
        index: 0,
        ownerAddress: walletAddress || String(userId || 0),
        eventUuid: eventUuid!,
      });
    }

    let targetIndex = 0;
    if (leafIndexParam !== null) {
      targetIndex = parseInt(leafIndexParam, 10);
      if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= leaves.length) {
        targetIndex = 0;
      }
    } else if (userId) {
      const matchIdx = checkedIn.findIndex((r) => r.userId === userId);
      if (matchIdx !== -1) targetIndex = matchIdx;
    } else if (walletAddress) {
      const matchIdx = checkedIn.findIndex((r) => r.walletAddress === walletAddress);
      if (matchIdx !== -1) targetIndex = matchIdx;
    }

    const targetLeaf = leaves[targetIndex];
    const tree = await CsbtMerkleTree.fromLeaves(leaves);
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
        verified: isVerified,
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
