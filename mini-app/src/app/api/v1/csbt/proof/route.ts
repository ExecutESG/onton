import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { sbtCollections } from "@/db/schema/sbtCollections";
import { sbtItems } from "@/db/schema/sbtItems";
import { users } from "@/db/schema/users";
import eventDB from "@/db/modules/events.db";
import { usersDB } from "@/db/modules/users.db";
import { and, asc, eq } from "drizzle-orm";
import { CsbtMerkleTree, CsbtLeafData, serializeProofToCell, hashMetadata } from "@/lib/csbt";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/v1/csbt/proof:
 *   get:
 *     summary: Sovereign Compressed SBT (cSBT) Merkle Proof API
 *     description: Retrieves the cryptographic Merkle proof and serialized TON Cell BoC for an attendee's soulbound badge.
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

  // 3. Resolve attendee target
  const userId = userIdStr ? parseInt(userIdStr, 10) : undefined;

  // Fetch checked-in attendees
  const checkedIn = await db
    .select({
      id: eventRegistrants.id,
      registrantUuid: eventRegistrants.registrant_uuid,
      userId: eventRegistrants.user_id,
    })
    .from(eventRegistrants)
    .where(
      and(
        eq(eventRegistrants.event_uuid, eventUuid),
        eq(eventRegistrants.status, "checkedin")
      )
    )
    .orderBy(asc(eventRegistrants.id));

  // Build leaves
  const leaves: CsbtLeafData[] = checkedIn.map((reg, idx) => ({
    index: idx,
    ownerAddress: String(reg.userId || 0),
    eventUuid: eventUuid!,
  }));

  // Fallback single-leaf demo if event has no checked-in DB rows yet
  if (leaves.length === 0) {
    leaves.push({
      index: 0,
      ownerAddress: walletAddress || String(userId || 0),
      eventUuid: eventUuid!,
    });
  }

  // Find target leaf index
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
    // Attempt lookup by wallet
    const userRows = await db
      .select({ userId: users.user_id })
      .from(users)
      .where(eq(users.wallet_address, walletAddress))
      .limit(1);
    if (userRows.length > 0) {
      const matchIdx = checkedIn.findIndex((r) => r.userId === userRows[0].userId);
      if (matchIdx !== -1) targetIndex = matchIdx;
    }
  }

  const targetLeaf = leaves[targetIndex];

  // 4. Construct Merkle tree & extract proof
  const tree = await CsbtMerkleTree.fromLeaves(leaves);
  const proof = tree.getProof(targetIndex);

  // 5. Serialize proof steps into TON Cell BoC
  const proofCell = serializeProofToCell(proof.steps);
  const proofCellBoc = proofCell.toBoc().toString("base64");

  // 6. Offline verify check
  const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);

  return NextResponse.json(
    {
      success: true,
      eventUuid,
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
