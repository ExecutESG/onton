import { describe, it, expect } from "vitest";
import { Address } from "@ton/core";
import crypto from "crypto";
import {
  generateLeafHash,
  createLeafCell,
  normalizeAddressBuffer,
  getWalletlessUserHash,
  parseOwner,
  CsbtMerkleTree,
  CsbtLeafData,
} from "../../src/lib/csbt";

describe("cSBT G0 Leaf Owner Encoding & Deterministic Vectors", () => {
  const dummyWallet1 = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
  const dummyEventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

  describe("Wallet Users Encoding", () => {
    it("should normalize basechain wallet address into 33-byte buffer: workchain (0x00) + 32-byte hash", () => {
      const parsed = Address.parse(dummyWallet1);
      const ownerBuffer = normalizeAddressBuffer(dummyWallet1);

      expect(ownerBuffer.length).toBe(33);
      expect(ownerBuffer[0]).toBe(0); // workchain 0
      expect(ownerBuffer.subarray(1).equals(parsed.hash)).toBe(true);
    });

    it("should normalize masterchain wallet address into 33-byte buffer: workchain (0xFF) + 32-byte hash", () => {
      const mcAddress = "-1:1111111111111111111111111111111111111111111111111111111111111111";
      const parsed = Address.parse(mcAddress);
      const ownerBuffer = normalizeAddressBuffer(mcAddress);

      expect(ownerBuffer.length).toBe(33);
      expect(ownerBuffer.readInt8(0)).toBe(-1); // workchain -1
      expect(ownerBuffer[0]).toBe(0xff);
      expect(ownerBuffer.subarray(1).equals(parsed.hash)).toBe(true);
    });

    it("should generate deterministic leaf hash for wallet user", async () => {
      const leaf: CsbtLeafData = {
        index: 0,
        ownerAddress: dummyWallet1,
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const hash1 = await generateLeafHash(leaf);
      const hash2 = await generateLeafHash(leaf);

      expect(hash1.length).toBe(32);
      expect(hash1.equals(hash2)).toBe(true);

      // Verify manual SHA256 matches generateLeafHash
      const indexBuffer = Buffer.alloc(8);
      indexBuffer.writeBigUInt64BE(BigInt(0), 0);
      const ownerBuffer = normalizeAddressBuffer(dummyWallet1);
      const eventBuffer = Buffer.from(dummyEventUuid.replace(/-/g, ""), "hex");
      const metaBuffer = Buffer.alloc(32, 0);

      const expected = crypto
        .createHash("sha256")
        .update(Buffer.concat([indexBuffer, ownerBuffer, eventBuffer, metaBuffer]))
        .digest();

      expect(hash1.equals(expected)).toBe(true);
    });

    it("should generate valid TON Cell with owner_kind=0 for wallet user", async () => {
      const leaf: CsbtLeafData = {
        index: 7,
        ownerAddress: dummyWallet1,
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const cell = await createLeafCell(leaf);
      const cs = cell.beginParse();

      const index = cs.loadUint(64);
      expect(index).toBe(7);

      const ownerKind = cs.loadUint(1);
      expect(ownerKind).toBe(0); // 0 = wallet address

      const addr = cs.loadAddress();
      expect(addr.equals(Address.parse(dummyWallet1))).toBe(true);

      const eventUuidBuf = cs.loadBuffer(16);
      expect(eventUuidBuf.toString("hex")).toBe(dummyEventUuid.replace(/-/g, ""));

      const metaBuf = cs.loadBuffer(32);
      expect(metaBuf.equals(Buffer.alloc(32, 0))).toBe(true);
    });
  });

  describe("Wallet-less Users Encoding", () => {
    const testUserId = "987654321";

    it("should compute user hash as SHA256('onton:user:' + userId)", () => {
      const hash = getWalletlessUserHash(testUserId);
      const expected = crypto.createHash("sha256").update("onton:user:987654321", "utf-8").digest();

      expect(hash.length).toBe(32);
      expect(hash.equals(expected)).toBe(true);
    });

    it("should normalize wallet-less user to 33 bytes with 0x7F marker byte", () => {
      const ownerBuffer = normalizeAddressBuffer(testUserId);

      expect(ownerBuffer.length).toBe(33);
      expect(ownerBuffer[0]).toBe(0x7f); // 0x7F marker
      expect(ownerBuffer.subarray(1).equals(getWalletlessUserHash(testUserId))).toBe(true);
    });

    it("should treat 'onton:user:987654321' identically to '987654321'", () => {
      const buf1 = normalizeAddressBuffer("987654321");
      const buf2 = normalizeAddressBuffer("onton:user:987654321");

      expect(buf1.equals(buf2)).toBe(true);
    });

    it("should support numeric userId via CsbtLeafData.userId field", async () => {
      const leafWithStr: CsbtLeafData = {
        index: 0,
        ownerAddress: "987654321",
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const leafWithNum: CsbtLeafData = {
        index: 0,
        userId: 987654321,
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const hash1 = await generateLeafHash(leafWithStr);
      const hash2 = await generateLeafHash(leafWithNum);

      expect(hash1.equals(hash2)).toBe(true);
    });

    it("should generate deterministic leaf hash for wallet-less user", async () => {
      const leaf: CsbtLeafData = {
        index: 0,
        ownerAddress: testUserId,
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const hash1 = await generateLeafHash(leaf);
      const hash2 = await generateLeafHash(leaf);

      expect(hash1.length).toBe(32);
      expect(hash1.equals(hash2)).toBe(true);

      const indexBuffer = Buffer.alloc(8);
      indexBuffer.writeBigUInt64BE(BigInt(0), 0);
      const ownerBuffer = normalizeAddressBuffer(testUserId);
      const eventBuffer = Buffer.from(dummyEventUuid.replace(/-/g, ""), "hex");
      const metaBuffer = Buffer.alloc(32, 0);

      const expected = crypto
        .createHash("sha256")
        .update(Buffer.concat([indexBuffer, ownerBuffer, eventBuffer, metaBuffer]))
        .digest();

      expect(hash1.equals(expected)).toBe(true);
    });

    it("should generate valid TON Cell with owner_kind=1 and 256-bit hash for wallet-less user", async () => {
      const leaf: CsbtLeafData = {
        index: 12,
        ownerAddress: testUserId,
        eventUuid: dummyEventUuid,
        metadataHash: Buffer.alloc(32, 0),
      };

      const cell = await createLeafCell(leaf);
      const cs = cell.beginParse();

      const index = cs.loadUint(64);
      expect(index).toBe(12);

      const ownerKind = cs.loadUint(1);
      expect(ownerKind).toBe(1); // 1 = wallet-less user

      const userHashBuf = cs.loadBuffer(32);
      expect(userHashBuf.equals(getWalletlessUserHash(testUserId))).toBe(true);

      const eventUuidBuf = cs.loadBuffer(16);
      expect(eventUuidBuf.toString("hex")).toBe(dummyEventUuid.replace(/-/g, ""));

      const metaBuf = cs.loadBuffer(32);
      expect(metaBuf.equals(Buffer.alloc(32, 0))).toBe(true);
    });
  });

  describe("Mixed Merkle Tree & Inclusion Proofs", () => {
    it("should generate and verify Merkle proofs for mixed wallet and wallet-less attendees", async () => {
      const leaves: CsbtLeafData[] = [
        {
          index: 0,
          ownerAddress: dummyWallet1,
          eventUuid: dummyEventUuid,
          metadata: { name: "Alice (Wallet)" },
        },
        {
          index: 1,
          ownerAddress: "10001",
          eventUuid: dummyEventUuid,
          metadata: { name: "Bob (Wallet-less)" },
        },
        {
          index: 2,
          ownerAddress: "EQAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIp3C",
          eventUuid: dummyEventUuid,
          metadata: { name: "Charlie (Wallet)" },
        },
        {
          index: 3,
          userId: 20002,
          eventUuid: dummyEventUuid,
          metadata: { name: "Dave (Wallet-less)" },
        },
      ];

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      expect(tree.leafCount).toBe(4);
      expect(tree.depth).toBe(2);

      const root = tree.getRoot();

      // Verify each leaf's proof
      for (let i = 0; i < leaves.length; i++) {
        const leafHash = await generateLeafHash(leaves[i]);
        const proof = tree.getProof(i);

        expect(proof.leafHash.equals(leafHash)).toBe(true);
        expect(proof.root.equals(root)).toBe(true);

        const isValid = CsbtMerkleTree.verifyProof(leafHash, proof, root);
        expect(isValid).toBe(true);
      }
    });

    it("should reject tampered proofs when switching identity from wallet to wallet-less", async () => {
      const walletLeaf: CsbtLeafData = {
        index: 0,
        ownerAddress: dummyWallet1,
        eventUuid: dummyEventUuid,
      };

      const walletlessLeaf: CsbtLeafData = {
        index: 0,
        ownerAddress: "99999",
        eventUuid: dummyEventUuid,
      };

      const tree = await CsbtMerkleTree.fromLeaves([walletLeaf]);
      const root = tree.getRoot();
      const proof = tree.getProof(0);

      // Verify legitimate wallet leaf passes
      const walletHash = await generateLeafHash(walletLeaf);
      expect(CsbtMerkleTree.verifyProof(walletHash, proof, root)).toBe(true);

      // Tamper: verify wallet-less leaf hash against the wallet tree proof fails
      const walletlessHash = await generateLeafHash(walletlessLeaf);
      expect(CsbtMerkleTree.verifyProof(walletlessHash, proof, root)).toBe(false);
    });
  });
});
