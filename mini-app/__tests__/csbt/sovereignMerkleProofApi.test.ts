import { describe, it, expect } from "vitest";
import {
  CsbtMerkleTree,
  CsbtLeafData,
  serializeProofToCell,
  deserializeProofCell,
} from "../../src/lib/csbt";
import { importCsbtHistory } from "../../scripts/import-csbt-history";
import fs from "fs";
import path from "path";

describe("Sovereign Merkle Proof API & Ingestion Engine (Issue #994)", () => {
  const eventUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("should construct valid TON Cell BoC proof chain for a tree of attendees", async () => {
    // Generate 16 attendees
    const leaves: CsbtLeafData[] = Array.from({ length: 16 }, (_, i) => ({
      index: i,
      ownerAddress: `0:${i.toString(16).padStart(64, "0")}`,
      eventUuid,
      metadata: { attendeeTier: i === 0 ? "VIP" : "General" },
    }));

    const tree = await CsbtMerkleTree.fromLeaves(leaves);
    const rootHex = tree.getRootHex();
    expect(rootHex).toBeDefined();

    // Verify each attendee's proof serialization to base64 BoC
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      expect(proof.leafIndex).toBe(i);

      // Serialize to TON Cell
      const proofCell = serializeProofToCell(proof.steps);
      expect(proofCell).toBeDefined();

      const bocBase64 = proofCell.toBoc().toString("base64");
      expect(typeof bocBase64).toBe("string");
      expect(bocBase64.length).toBeGreaterThan(0);

      // Verify deserialization matches original steps
      const deserializedSteps = deserializeProofCell(proofCell);
      expect(deserializedSteps.length).toBe(proof.steps.length);

      // Offline verification succeeds
      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);
      expect(isVerified).toBe(true);
    }
  });

  it("should support deep Merkle trees (depth > 10, 1024+ attendees)", async () => {
    const leafCount = 1024;
    const leaves: CsbtLeafData[] = Array.from({ length: leafCount }, (_, i) => ({
      index: i,
      ownerAddress: `0:${i.toString(16).padStart(64, "0")}`,
      eventUuid,
    }));

    const tree = await CsbtMerkleTree.fromLeaves(leaves);
    expect(tree.leafCount).toBe(leafCount);

    // Pick arbitrary sample leaves across the tree
    const testIndices = [0, 1, 42, 511, 789, 1023];
    for (const idx of testIndices) {
      const proof = tree.getProof(idx);
      expect(proof.steps.length).toBe(10); // log2(1024) = 10 steps

      const proofCell = serializeProofToCell(proof.steps);
      const bocBase64 = proofCell.toBoc().toString("base64");
      expect(bocBase64).toBeDefined();

      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);
      expect(isVerified).toBe(true);
    }
  });

  it("should parse and compute Merkle root from JSON attendee list in dry-run mode", async () => {
    const tmpJsonPath = path.join("/tmp", `test-attendees-${Date.now()}.json`);
    const mockAttendees = [
      { wallet_address: "EQB_TEST_WALLET_1", user_id: 1001, badge_title: "Hacker Pass" },
      { wallet_address: "EQB_TEST_WALLET_2", user_id: 1002, badge_title: "Speaker Pass" },
      { wallet_address: "EQB_TEST_WALLET_3", user_id: 1003, badge_title: "VIP Pass" },
    ];
    fs.writeFileSync(tmpJsonPath, JSON.stringify(mockAttendees));

    try {
      const res = await importCsbtHistory({
        filePath: tmpJsonPath,
        eventUuid,
        dryRun: true,
      });

      expect(res.totalProcessed).toBe(3);
      expect(res.computedRootHex).toMatch(/^[0-9a-f]{64}$/);
      expect(res.rootMatched).toBe(true);
      expect(res.insertedCount).toBe(0); // dry-run
    } finally {
      if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath);
    }
  });

  it("should parse and compute Merkle root from CSV attendee list in dry-run mode", async () => {
    const tmpCsvPath = path.join("/tmp", `test-attendees-${Date.now()}.csv`);
    const csvContent = [
      "wallet_address,user_id,badge_title",
      "EQB_ALICE,2001,Hackathon Winner",
      "EQB_BOB,2002,Hackathon Finalist",
      "EQB_CHARLIE,2003,General Admission",
    ].join("\n");
    fs.writeFileSync(tmpCsvPath, csvContent);

    try {
      const res = await importCsbtHistory({
        filePath: tmpCsvPath,
        eventUuid,
        dryRun: true,
      });

      expect(res.totalProcessed).toBe(3);
      expect(res.computedRootHex).toMatch(/^[0-9a-f]{64}$/);
      expect(res.rootMatched).toBe(true);
    } finally {
      if (fs.existsSync(tmpCsvPath)) fs.unlinkSync(tmpCsvPath);
    }
  });

  it("should detect root mismatch against an expected root", async () => {
    const tmpJsonPath = path.join("/tmp", `test-attendees-${Date.now()}.json`);
    fs.writeFileSync(tmpJsonPath, JSON.stringify([{ wallet_address: "EQB_TEST" }]));

    try {
      await expect(
        importCsbtHistory({
          filePath: tmpJsonPath,
          eventUuid,
          expectedRootHex: "0000000000000000000000000000000000000000000000000000000000000000",
          dryRun: true,
        })
      ).rejects.toThrow(/Merkle root mismatch/);
    } finally {
      if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath);
    }
  });
});
