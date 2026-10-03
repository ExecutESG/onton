import { describe, it, expect } from "vitest";
import {
  generateLeafHash,
  hashMetadata,
  hashNodePair,
  createLeafCell,
  CsbtMerkleTree,
  serializeProofToCell,
  deserializeProofCell,
  CsbtLeafData,
} from "../../src/lib/csbt";

describe("Phase 2 Compressed SBT (cSBT) Merkle Engine", () => {
  const dummyOwner1 = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
  const dummyOwner2 = "EQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIp3C";
  const dummyOwner3 = "EQAzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM7SN";
  const dummyEventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

  describe("Leaf Generation & Formatting", () => {
    it("should compute deterministic 32-byte leaf hash", async () => {
      const leaf1: CsbtLeafData = {
        index: 0,
        ownerAddress: dummyOwner1,
        eventUuid: dummyEventUuid,
        metadata: { name: "VIP Attendee #1" },
      };

      const leaf2: CsbtLeafData = {
        index: 0,
        ownerAddress: dummyOwner1,
        eventUuid: dummyEventUuid,
        metadata: { name: "VIP Attendee #1" },
      };

      const hash1 = await generateLeafHash(leaf1);
      const hash2 = await generateLeafHash(leaf2);

      expect(hash1.length).toBe(32);
      expect(hash1.equals(hash2)).toBe(true);
    });

    it("should produce distinct hashes when leaf attributes change", async () => {
      const baseLeaf: CsbtLeafData = {
        index: 0,
        ownerAddress: dummyOwner1,
        eventUuid: dummyEventUuid,
        metadata: { role: "Guest" },
      };

      const diffIndex = await generateLeafHash({ ...baseLeaf, index: 1 });
      const diffOwner = await generateLeafHash({ ...baseLeaf, ownerAddress: dummyOwner2 });
      const diffEvent = await generateLeafHash({
        ...baseLeaf,
        eventUuid: "00000000-0000-0000-0000-000000000000",
      });
      const diffMeta = await generateLeafHash({
        ...baseLeaf,
        metadata: { role: "Speaker" },
      });

      const baseHash = await generateLeafHash(baseLeaf);

      expect(baseHash.equals(diffIndex)).toBe(false);
      expect(baseHash.equals(diffOwner)).toBe(false);
      expect(baseHash.equals(diffEvent)).toBe(false);
      expect(baseHash.equals(diffMeta)).toBe(false);
    });

    it("should generate a valid TON Cell for on-chain leaf representation", async () => {
      const leaf: CsbtLeafData = {
        index: 42,
        ownerAddress: dummyOwner1,
        eventUuid: dummyEventUuid,
        metadata: { badge: "Early Bird" },
      };

      const cell = await createLeafCell(leaf);
      expect(cell).toBeDefined();
      expect(cell.bits.length).toBeGreaterThan(0);
      const boc = cell.toBoc();
      expect(boc.length).toBeGreaterThan(0);
    });
  });

  describe("Merkle Tree Construction & Root Calculation", () => {
    it("should build a single-leaf tree with root equal to the leaf itself", async () => {
      const leafHash = Buffer.alloc(32, 7);
      const tree = new CsbtMerkleTree([leafHash]);

      expect(tree.leafCount).toBe(1);
      expect(tree.getRoot().equals(leafHash)).toBe(true);
      expect(tree.getRootHex()).toBe(leafHash.toString("hex"));
      expect(tree.getRootBigInt()).toBe(BigInt("0x" + leafHash.toString("hex")));
    });

    it("should build a 2-leaf tree with root equal to hashNodePair(leaf0, leaf1)", async () => {
      const leaf0 = Buffer.alloc(32, 1);
      const leaf1 = Buffer.alloc(32, 2);
      const tree = new CsbtMerkleTree([leaf0, leaf1]);

      const expectedRoot = hashNodePair(leaf0, leaf1);
      expect(tree.leafCount).toBe(2);
      expect(tree.depth).toBe(1);
      expect(tree.getRoot().equals(expectedRoot)).toBe(true);
    });

    it("should handle odd numbers of leaves via deterministic branch duplication", async () => {
      const leaves = [Buffer.alloc(32, 1), Buffer.alloc(32, 2), Buffer.alloc(32, 3)];
      const tree = new CsbtMerkleTree(leaves);

      // Layer 0: [leaf0, leaf1, leaf2]
      // Layer 1: [hash(leaf0, leaf1), hash(leaf2, leaf2)]
      // Layer 2 (Root): hash(layer1[0], layer1[1])
      const layer1_0 = hashNodePair(leaves[0], leaves[1]);
      const layer1_1 = hashNodePair(leaves[2], leaves[2]);
      const expectedRoot = hashNodePair(layer1_0, layer1_1);

      expect(tree.leafCount).toBe(3);
      expect(tree.getRoot().equals(expectedRoot)).toBe(true);
    });

    it("should build from CsbtLeafData records", async () => {
      const leafData: CsbtLeafData[] = [
        { index: 0, ownerAddress: dummyOwner1, eventUuid: dummyEventUuid, metadata: { id: 1 } },
        { index: 1, ownerAddress: dummyOwner2, eventUuid: dummyEventUuid, metadata: { id: 2 } },
        { index: 2, ownerAddress: dummyOwner3, eventUuid: dummyEventUuid, metadata: { id: 3 } },
        { index: 3, ownerAddress: dummyOwner1, eventUuid: dummyEventUuid, metadata: { id: 4 } },
      ];

      const tree = await CsbtMerkleTree.fromLeaves(leafData);
      expect(tree.leafCount).toBe(4);
      expect(tree.depth).toBe(2);
      expect(tree.getRoot().length).toBe(32);
    });
  });

  describe("Inclusion Proof Generation & Verification", () => {
    it("should generate valid proofs for all leaves in a power-of-two tree (16 leaves)", async () => {
      const leafHashes: Buffer[] = [];
      for (let i = 0; i < 16; i++) {
        leafHashes.push(Buffer.alloc(32, i + 1));
      }

      const tree = new CsbtMerkleTree(leafHashes);
      const root = tree.getRoot();

      for (let i = 0; i < 16; i++) {
        const proof = tree.getProof(i);
        expect(proof.leafIndex).toBe(i);
        expect(proof.leafHash.equals(leafHashes[i])).toBe(true);
        expect(proof.steps.length).toBe(4); // log2(16) = 4

        const isValid = CsbtMerkleTree.verifyProof(leafHashes[i], proof, root);
        expect(isValid).toBe(true);
      }
    });

    it("should generate valid proofs for an odd-sized tree (11 leaves)", async () => {
      const leafHashes: Buffer[] = [];
      for (let i = 0; i < 11; i++) {
        leafHashes.push(Buffer.alloc(32, i * 3 + 1));
      }

      const tree = new CsbtMerkleTree(leafHashes);
      const root = tree.getRoot();

      for (let i = 0; i < 11; i++) {
        const proof = tree.getProof(i);
        const isValid = CsbtMerkleTree.verifyProof(leafHashes[i], proof, root);
        expect(isValid).toBe(true);
      }
    });

    it("should scale efficiently to 1,000 leaves", async () => {
      const count = 1000;
      const leafHashes: Buffer[] = [];
      for (let i = 0; i < count; i++) {
        const b = Buffer.alloc(32);
        b.writeUInt32BE(i, 0);
        leafHashes.push(b);
      }

      const tree = new CsbtMerkleTree(leafHashes);
      const root = tree.getRoot();

      // Sample first, middle, last, and random leaves
      const sampleIndices = [0, 1, 499, 500, 777, 999];
      for (const idx of sampleIndices) {
        const proof = tree.getProof(idx);
        const isValid = CsbtMerkleTree.verifyProof(leafHashes[idx], proof, root);
        expect(isValid).toBe(true);
      }
    });

    it("should throw error when requesting proof for out-of-bounds index", () => {
      const tree = new CsbtMerkleTree([Buffer.alloc(32, 1), Buffer.alloc(32, 2)]);
      expect(() => tree.getProof(-1)).toThrow("out of bounds");
      expect(() => tree.getProof(2)).toThrow("out of bounds");
    });
  });

  describe("Negative & Tampering Tests", () => {
    it("should reject proof if the leaf hash has been tampered with", () => {
      const leaves = [Buffer.alloc(32, 1), Buffer.alloc(32, 2), Buffer.alloc(32, 3), Buffer.alloc(32, 4)];
      const tree = new CsbtMerkleTree(leaves);
      const root = tree.getRoot();

      const proof = tree.getProof(2);
      const tamperedLeaf = Buffer.alloc(32, 99); // Different hash

      const isValid = CsbtMerkleTree.verifyProof(tamperedLeaf, proof, root);
      expect(isValid).toBe(false);
    });

    it("should reject proof if any sibling hash in the proof path is modified", () => {
      const leaves = [Buffer.alloc(32, 1), Buffer.alloc(32, 2), Buffer.alloc(32, 3), Buffer.alloc(32, 4)];
      const tree = new CsbtMerkleTree(leaves);
      const root = tree.getRoot();

      const proof = tree.getProof(1);
      // Tamper with first step sibling
      proof.steps[0].sibling = Buffer.alloc(32, 0xff);

      const isValid = CsbtMerkleTree.verifyProof(leaves[1], proof, root);
      expect(isValid).toBe(false);
    });

    it("should reject proof against an incorrect root", () => {
      const leaves = [Buffer.alloc(32, 1), Buffer.alloc(32, 2)];
      const tree = new CsbtMerkleTree(leaves);

      const proof = tree.getProof(0);
      const fakeRoot = Buffer.alloc(32, 0xee);

      const isValid = CsbtMerkleTree.verifyProof(leaves[0], proof, fakeRoot);
      expect(isValid).toBe(false);
    });
  });

  describe("TON Cell Proof Serialization (FunC Contract Compatibility)", () => {
    it("should serialize proof steps into a valid TON Cell and deserialize losslessly", () => {
      const leaves: Buffer[] = [];
      for (let i = 0; i < 32; i++) {
        leaves.push(Buffer.alloc(32, i + 10));
      }

      const tree = new CsbtMerkleTree(leaves);
      const proof = tree.getProof(19);

      // Depth is 5 steps (log2(32)) -> tests multi-cell chaining (>3 steps)
      expect(proof.steps.length).toBe(5);

      const cell = CsbtMerkleTree.toProofCell(proof);
      expect(cell).toBeDefined();

      const boc = cell.toBoc();
      expect(boc.length).toBeGreaterThan(0);

      // Unpack and verify lossless round-trip
      const unpackedSteps = deserializeProofCell(cell);
      expect(unpackedSteps.length).toBe(proof.steps.length);

      for (let i = 0; i < proof.steps.length; i++) {
        expect(unpackedSteps[i].direction).toBe(proof.steps[i].direction);
        expect(unpackedSteps[i].sibling.equals(proof.steps[i].sibling)).toBe(true);
      }
    });
  });
});
