import { describe, it, expect, beforeEach, vi } from "vitest";
import { csbtTreesDB } from "../../src/db/modules/csbtTrees.db";
import { csbtTreeService, CsbtTreePayload } from "../../src/services/csbtTreeService";
import {
  computeEventHash,
  computeEventHashBigInt,
  CsbtMerkleTree,
  CsbtLeafData,
} from "../../src/lib/csbt";
import { GET as proofApiGet } from "../../src/app/api/v1/csbt/proof/route";
import { freezeCsbtTrees } from "../../src/cronJobs/tasks/freezeCsbtTrees";
import { anchorCsbtRoots, pollForOnChainRoot } from "../../src/cronJobs/tasks/anchorCsbtRoots";
import * as sbtLib from "../../src/lib/sbt";
import eventDB from "../../src/db/modules/events.db";
import { minioClient } from "../../src/lib/minioClient";
import { db } from "../../src/db/db";
import { NextRequest } from "next/server";
import { Readable } from "stream";

vi.mock("@/lib/redisTools", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
  deleteCache: vi.fn().mockResolvedValue(true),
  cacheKeys: {
    ontonSettings: "ontonSettings",
    ontonSettingsProtected: "ontonSettingsProtected",
  },
}));

vi.mock("@/db/modules/ontoSetting", () => ({
  fetchOntonSettings: vi.fn().mockResolvedValue({ config: {}, configProtected: {} }),
}));

describe("cSBT Persisted Trees, Anchoring & Proof API (Issue #1037)", () => {
  const testEventUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

  describe("Event Hash Computation", () => {
    it("should compute deterministic SHA-256 event hash for native and legacy kinds", () => {
      const nativeHash = computeEventHash("native", testEventUuid);
      const legacyHash = computeEventHash("legacy", testEventUuid);

      expect(nativeHash.length).toBe(32);
      expect(legacyHash.length).toBe(32);
      expect(nativeHash.equals(legacyHash)).toBe(false);

      const nativeBigInt = computeEventHashBigInt("native", testEventUuid);
      expect(nativeBigInt).toBe(BigInt("0x" + nativeHash.toString("hex")));
    });
  });

  describe("MinIO Payload Storage & Retrieval", () => {
    const inMemoryStorage = new Map<string, Buffer>();

    beforeEach(() => {
      inMemoryStorage.clear();

      vi.spyOn(minioClient, "bucketExists").mockResolvedValue(true);
      vi.spyOn(minioClient, "makeBucket").mockResolvedValue(undefined as any);
      vi.spyOn(minioClient, "setBucketPolicy").mockResolvedValue(undefined as any);

      vi.spyOn(minioClient, "putObject").mockImplementation(
        async (bucket: string, name: string, data: any) => {
          inMemoryStorage.set(
            `${bucket}/${name}`,
            Buffer.isBuffer(data) ? data : Buffer.from(data)
          );
          return { etag: "mock", versionId: null };
        }
      );

      vi.spyOn(minioClient, "getObject").mockImplementation(
        async (bucket: string, name: string) => {
          const buf = inMemoryStorage.get(`${bucket}/${name}`) || Buffer.from("{}");
          return Readable.from(buf);
        }
      );
    });

    it("should upload and retrieve frozen tree payload with exact leaf reconstruction", async () => {
      const leaves: CsbtLeafData[] = [
        {
          index: 0,
          ownerAddress: "EQAREREREREREREREREREREREREREREREREREREREREREeYT",
          eventUuid: testEventUuid,
          metadata: { ticketTier: "General" },
        },
        {
          index: 1,
          ownerAddress: "987654321", // Wallet-less attendee
          userId: 987654321,
          eventUuid: testEventUuid,
          metadata: { ticketTier: "VIP" },
        },
      ];

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      const root = tree.getRootHex();

      const payload: CsbtTreePayload = {
        eventUuid: testEventUuid,
        kind: "native",
        root,
        leafCount: leaves.length,
        frozenAt: new Date().toISOString(),
        leaves,
      };

      // Upload to MinIO (using mock client)
      const minioKey = await csbtTreeService.uploadPayloadToMinio("native", testEventUuid, payload);
      expect(minioKey).toContain(testEventUuid);

      // Load back
      const loaded = await csbtTreeService.loadPayloadFromMinio(minioKey);
      expect(loaded.eventUuid).toBe(testEventUuid);
      expect(loaded.root).toBe(root);
      expect(loaded.leafCount).toBe(2);
      expect(loaded.leaves.length).toBe(2);

      // Reconstruct tree and verify roots match
      const reconstructedTree = await CsbtMerkleTree.fromLeaves(loaded.leaves);
      expect(reconstructedTree.getRootHex()).toBe(root);

      // Verify inclusion proof from reconstructed tree
      const proof0 = reconstructedTree.getProof(0);
      const proof1 = reconstructedTree.getProof(1);

      expect(CsbtMerkleTree.verifyProof(proof0.leafHash, proof0, tree.getRoot())).toBe(true);
      expect(CsbtMerkleTree.verifyProof(proof1.leafHash, proof1, tree.getRoot())).toBe(true);
    });
  });

  describe("Proof API Serving from Frozen Trees", () => {
    it("should serve proof from frozen tree when present and verify against frozen root", async () => {
      const mockEventUuid = "99999999-9999-9999-9999-999999999999";

      // Mock eventDB
      vi.spyOn(eventDB, "fetchEventByUuid").mockResolvedValueOnce({
        id: 1,
        event_uuid: mockEventUuid,
        title: "TON Global Summit",
        description: "Official Summit",
        start_date: 1700000000,
        end_date: 1700086400,
        sbt_collection_address: "EQ_COLLECTION_123",
      } as any);

      // Mock csbtTreeService.getFrozenTree
      const leaves: CsbtLeafData[] = [
        {
          index: 0,
          ownerAddress: "EQAREREREREREREREREREREREREREREREREREREREREREeYT",
          eventUuid: mockEventUuid,
        },
        {
          index: 1,
          ownerAddress: "12345",
          userId: 12345,
          eventUuid: mockEventUuid,
        },
      ];
      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      const rootHex = tree.getRootHex();

      vi.spyOn(csbtTreeService, "getFrozenTree").mockResolvedValueOnce({
        record: {
          id: 77,
          eventUuid: mockEventUuid,
          kind: "native",
          root: rootHex,
          leafCount: 2,
          minioKey: `csbt-trees/events/${mockEventUuid}/native.json`,
          anchorTxHash: "ton:seqno:42",
          anchoredAt: new Date(),
          frozenAt: new Date(),
        },
        tree,
        payload: {
          eventUuid: mockEventUuid,
          kind: "native",
          root: rootHex,
          leafCount: 2,
          frozenAt: new Date().toISOString(),
          leaves,
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}&userId=12345`
      );

      const res = await proofApiGet(req);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.isFrozen).toBe(true);
      expect(body.anchored).toBe(true);
      expect(body.anchorTxHash).toBe("ton:seqno:42");
      expect(body.merkleRootHex).toBe(rootHex);
      expect(body.leafIndex).toBe(1);
      expect(body.verified).toBe(true);
      expect(body.proofCellBoc).toBeDefined();

      // Fresh cryptographic proof verification against the returned root
      const proof1 = tree.getProof(1);
      const isVerified = CsbtMerkleTree.verifyProof(proof1.leafHash, proof1, tree.getRoot());
      expect(isVerified).toBe(true);
    });

    it("should serve dynamic tree with anchored: false when event is live (not frozen)", async () => {
      const liveEventUuid = "88888888-8888-8888-8888-888888888888";

      vi.spyOn(eventDB, "fetchEventByUuid").mockResolvedValueOnce({
        id: 2,
        event_uuid: liveEventUuid,
        title: "Live Hackathon",
        start_date: 1700000000,
        end_date: 1800000000,
      } as any);

      vi.spyOn(csbtTreeService, "getFrozenTree").mockResolvedValueOnce(null);

      // Mock DB query for checked-in attendees
      vi.spyOn(db, "select").mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              orderBy: vi.fn().mockResolvedValueOnce([
                {
                  id: 1,
                  registrantUuid: "reg-1",
                  userId: 555,
                  walletAddress: null,
                },
              ]),
            }),
          }),
        }),
      } as any);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/csbt/proof?eventUuid=${liveEventUuid}&userId=555`
      );

      const res = await proofApiGet(req);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.isFrozen).toBe(false);
      expect(body.anchored).toBe(false);
      expect(body.anchorTxHash).toBeNull();
      expect(body.merkleRootHex).toBeDefined();
      expect(body.verified).toBe(true);
    });
  });

  describe("Crons Execution Behavior", () => {
    it("anchorCsbtRoots should skip cleanly with warning if CSBT_REGISTRY_ADDRESS is unset", async () => {
      delete process.env.CSBT_REGISTRY_ADDRESS;
      await expect(anchorCsbtRoots()).resolves.toBeUndefined();
    });

    it("pollForOnChainRoot should return true when contract getter returns expected root", async () => {
      const mockClient = {
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readBigNumber: () => BigInt("0xabcdef123456"),
          },
        }),
      };

      const result = await pollForOnChainRoot(
        mockClient as any,
        "EQAREREREREREREREREREREREREREREREREREREREREREeYT",
        BigInt(123),
        BigInt("0xabcdef123456"),
        2,
        10
      );
      expect(result).toBe(true);
    });

    it("pollForOnChainRoot should return false when getter returns mismatch or 0n", async () => {
      const mockClient = {
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readBigNumber: () => BigInt(0),
          },
        }),
      };

      const result = await pollForOnChainRoot(
        mockClient as any,
        "EQAREREREREREREREREREREREREREREREREREREREREREeYT",
        BigInt(123),
        BigInt("0xabcdef123456"),
        2,
        10
      );
      expect(result).toBe(false);
    });

    it("anchorCsbtRoots should support CSBT_ANCHOR_MNEMONIC and mark tree anchored when getter verifies root", async () => {
      process.env.CSBT_REGISTRY_ADDRESS = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
      process.env.CSBT_ANCHOR_MNEMONIC = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";
      delete process.env.MNEMONIC;

      const mockTree = {
        id: 42,
        eventUuid: "11111111-1111-1111-1111-111111111111",
        kind: "native" as const,
        root: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      };

      vi.spyOn(csbtTreesDB, "getUnanchoredTrees").mockResolvedValueOnce([mockTree as any]);
      const markAnchoredSpy = vi.spyOn(csbtTreesDB, "markTreeAnchored").mockResolvedValueOnce(undefined as any);

      const mockWallet = {
        contract: {
          getSeqno: vi.fn().mockResolvedValue(10),
          sendTransfer: vi.fn().mockResolvedValue(undefined),
        },
        keyPair: { secretKey: Buffer.alloc(64) },
      };
      vi.spyOn(sbtLib, "openWallet").mockResolvedValueOnce(mockWallet as any);
      vi.spyOn(sbtLib, "waitSeqno").mockResolvedValueOnce(11);

      const expectedRootBigInt = BigInt("0x" + mockTree.root);
      const tonCenter = await import("../../src/services/tonCenter");
      vi.spyOn(tonCenter, "v2_client").mockReturnValue({
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readBigNumber: () => expectedRootBigInt,
          },
        }),
      } as any);

      await anchorCsbtRoots();

      expect(markAnchoredSpy).toHaveBeenCalledWith(42, "ton:seqno:11");
    });

    it("anchorCsbtRoots should NOT mark tree anchored if root was rejected or bounced despite seqno increment", async () => {
      process.env.CSBT_REGISTRY_ADDRESS = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
      process.env.MNEMONIC = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";
      process.env.CSBT_ANCHOR_POLL_ATTEMPTS = "2";
      process.env.CSBT_ANCHOR_POLL_INTERVAL_MS = "10";
      delete process.env.CSBT_ANCHOR_MNEMONIC;

      const mockTree = {
        id: 99,
        eventUuid: "22222222-2222-2222-2222-222222222222",
        kind: "native" as const,
        root: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      };

      vi.spyOn(csbtTreesDB, "getUnanchoredTrees").mockResolvedValueOnce([mockTree as any]);
      const markAnchoredSpy = vi.spyOn(csbtTreesDB, "markTreeAnchored");

      const mockWallet = {
        contract: {
          getSeqno: vi.fn().mockResolvedValue(20),
          sendTransfer: vi.fn().mockResolvedValue(undefined),
        },
        keyPair: { secretKey: Buffer.alloc(64) },
      };
      vi.spyOn(sbtLib, "openWallet").mockResolvedValueOnce(mockWallet as any);
      vi.spyOn(sbtLib, "waitSeqno").mockResolvedValueOnce(21);

      const tonCenter = await import("../../src/services/tonCenter");
      vi.spyOn(tonCenter, "v2_client").mockReturnValue({
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readBigNumber: () => BigInt(0), // Rejected / bounced on-chain
          },
        }),
      } as any);

      await anchorCsbtRoots();

      // markTreeAnchored MUST NOT have been called!
      expect(markAnchoredSpy).not.toHaveBeenCalled();
    });

    it("pollForOnChainRoot should return false if registry address is malformed", async () => {
      const mockClient = {
        runMethod: vi.fn(),
      };
      const result = await pollForOnChainRoot(
        mockClient as any,
        "invalid-not-an-address",
        BigInt(123),
        BigInt(456),
        1,
        10
      );
      expect(result).toBe(false);
      expect(mockClient.runMethod).not.toHaveBeenCalled();
    });

    it("anchorCsbtRoots should handle 0x-prefixed root string seamlessly", async () => {
      process.env.CSBT_REGISTRY_ADDRESS = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
      process.env.CSBT_ANCHOR_MNEMONIC = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";
      delete process.env.MNEMONIC;

      const mockTree = {
        id: 77,
        eventUuid: "33333333-3333-3333-3333-333333333333",
        kind: "native" as const,
        root: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", // Already has 0x
      };

      vi.spyOn(csbtTreesDB, "getUnanchoredTrees").mockResolvedValueOnce([mockTree as any]);
      const markAnchoredSpy = vi.spyOn(csbtTreesDB, "markTreeAnchored").mockResolvedValueOnce(undefined as any);

      const mockWallet = {
        contract: {
          getSeqno: vi.fn().mockResolvedValue(5),
          sendTransfer: vi.fn().mockResolvedValue(undefined),
        },
        keyPair: { secretKey: Buffer.alloc(64) },
      };
      vi.spyOn(sbtLib, "openWallet").mockResolvedValueOnce(mockWallet as any);
      vi.spyOn(sbtLib, "waitSeqno").mockResolvedValueOnce(6);

      const expectedRootBigInt = BigInt(mockTree.root);
      const tonCenter = await import("../../src/services/tonCenter");
      vi.spyOn(tonCenter, "v2_client").mockReturnValue({
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readBigNumber: () => expectedRootBigInt,
          },
        }),
      } as any);

      await anchorCsbtRoots();

      expect(markAnchoredSpy).toHaveBeenCalledWith(77, "ton:seqno:6");
    });

    it("anchorCsbtRoots should skip marking tree anchored if waitSeqno times out and seqno does not increment", async () => {
      process.env.CSBT_REGISTRY_ADDRESS = "EQAREREREREREREREREREREREREREREREREREREREREREeYT";
      process.env.MNEMONIC = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";
      delete process.env.CSBT_ANCHOR_MNEMONIC;

      const mockTree = {
        id: 88,
        eventUuid: "44444444-4444-4444-4444-444444444444",
        kind: "native" as const,
        root: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      };

      vi.spyOn(csbtTreesDB, "getUnanchoredTrees").mockResolvedValueOnce([mockTree as any]);
      const markAnchoredSpy = vi.spyOn(csbtTreesDB, "markTreeAnchored");

      const mockWallet = {
        contract: {
          getSeqno: vi.fn().mockResolvedValue(10), // before: 10, re-checked: 10
          sendTransfer: vi.fn().mockResolvedValue(undefined),
        },
        keyPair: { secretKey: Buffer.alloc(64) },
      };
      vi.spyOn(sbtLib, "openWallet").mockResolvedValueOnce(mockWallet as any);
      vi.spyOn(sbtLib, "waitSeqno").mockResolvedValueOnce(-1); // timed out

      const tonCenter = await import("../../src/services/tonCenter");
      const runMethodSpy = vi.fn();
      vi.spyOn(tonCenter, "v2_client").mockReturnValue({
        runMethod: runMethodSpy,
      } as any);

      await anchorCsbtRoots();

      // markTreeAnchored MUST NOT have been called, and pollForOnChainRoot was skipped
      expect(markAnchoredSpy).not.toHaveBeenCalled();
      expect(runMethodSpy).not.toHaveBeenCalled();
    });

    it("freezeCsbtTrees should complete execution cycle without unhandled errors", async () => {
      vi.spyOn(csbtTreesDB, "getEndedEventsWithoutNativeTree").mockResolvedValueOnce([]);
      await expect(freezeCsbtTrees()).resolves.toBeUndefined();
    });
  });
});
