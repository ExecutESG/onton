import { describe, it, expect } from "vitest";
import {
  SBT_ONCHAIN_UPGRADE_PRICE,
  SBT_MINT_GAS_FEE,
  SBT_PLATFORM_FEE,
} from "../../src/constants";
import { CsbtMerkleTree, CsbtLeafData } from "../../src/lib/csbt";
import { beginCell } from "@ton/core";

describe("On-Demand SBT Minting: Pricing & Math", () => {
  it("should enforce exact attendee price of 0.1 TON", () => {
    expect(SBT_ONCHAIN_UPGRADE_PRICE).toBe(0.1);
  });

  it("should forward 0.055 TON for smart contract gas/deployment", () => {
    expect(SBT_MINT_GAS_FEE).toBe(0.055);
  });

  it("should retain 0.045 TON as protocol revenue", () => {
    expect(SBT_PLATFORM_FEE).toBe(0.045);
  });

  it("should satisfy exact revenue equation without floating point drift", () => {
    const calculatedFee = Number((SBT_ONCHAIN_UPGRADE_PRICE - SBT_MINT_GAS_FEE).toFixed(3));
    expect(calculatedFee).toBe(SBT_PLATFORM_FEE);
  });
});

describe("Tier 1: Free cSBT Merkle Tree Verification", () => {
  it("should construct tree from attendee leaves and verify inclusion proofs", async () => {
    const eventUuid = "550e8400-e29b-41d4-a716-446655440000";
    const leaves: CsbtLeafData[] = [
      { index: 0, ownerAddress: "user-101", eventUuid },
      { index: 1, ownerAddress: "user-102", eventUuid },
      { index: 2, ownerAddress: "user-103", eventUuid },
    ];

    const tree = await CsbtMerkleTree.fromLeaves(leaves);
    const root = tree.getRoot();
    expect(root).toBeDefined();
    expect(tree.getRootHex()).toHaveLength(64); // 32-byte hex

    // Verify proof for each attendee
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      expect(proof.leafIndex).toBe(i);
      const isValid = CsbtMerkleTree.verifyProof(proof.leafHash, proof, root);
      expect(isValid).toBe(true);
    }
  });

  it("should reject tampered leaf hashes in Merkle proof verification", async () => {
    const eventUuid = "550e8400-e29b-41d4-a716-446655440000";
    const leaves: CsbtLeafData[] = [
      { index: 0, ownerAddress: "user-101", eventUuid },
      { index: 1, ownerAddress: "user-102", eventUuid },
    ];

    const tree = await CsbtMerkleTree.fromLeaves(leaves);
    const proof = tree.getProof(0);

    // Tampered leaf
    const tamperedLeaf = Buffer.alloc(32, 0xff);
    const isValid = CsbtMerkleTree.verifyProof(tamperedLeaf, proof, tree.getRoot());
    expect(isValid).toBe(false);
  });
});

describe("Tier 2: TonConnect Upgrade Memo & Payment Matching", () => {
  it("should serialize the sbt_upgrade comment correctly in TON Cell", () => {
    const ticketUuid = "ticket-test-12345";
    const memo = `sbt_upgrade:${ticketUuid}`;

    const cell = beginCell()
      .storeUint(0, 32)
      .storeStringTail(memo)
      .endCell();

    const slice = cell.beginParse();
    const op = slice.loadUint(32);
    const text = slice.loadStringTail();

    expect(op).toBe(0);
    expect(text).toBe(memo);
    expect(text.startsWith("sbt_upgrade:")).toBe(true);
    expect(text.replace("sbt_upgrade:", "")).toBe(ticketUuid);
  });

  it("should match valid incoming 0.1 TON payment with ticket uuid", () => {
    const targetTicket = "ticket-uuid-abc";
    const mockParsedTransactions = [
      { order_uuid: "other-order-1", rawAmount: BigInt(100_000_000) },
      { order_uuid: targetTicket, rawAmount: BigInt(100_000_000) }, // 0.1 TON
      { order_uuid: "other-order-2", rawAmount: BigInt(50_000_000) },
    ];

    const match = mockParsedTransactions.find(
      (tx) => tx.order_uuid === targetTicket && tx.rawAmount >= BigInt(95_000_000)
    );

    expect(match).toBeDefined();
    expect(match?.order_uuid).toBe(targetTicket);
    expect(match?.rawAmount).toBe(BigInt(100_000_000));
  });

  it("should reject underpaid transaction for sbt upgrade", () => {
    const targetTicket = "ticket-uuid-abc";
    const mockParsedTransactions = [
      { order_uuid: targetTicket, rawAmount: BigInt(50_000_000) }, // only 0.05 TON
    ];

    const match = mockParsedTransactions.find(
      (tx) => tx.order_uuid === targetTicket && tx.rawAmount >= BigInt(95_000_000)
    );

    expect(match).toBeUndefined();
  });
});
