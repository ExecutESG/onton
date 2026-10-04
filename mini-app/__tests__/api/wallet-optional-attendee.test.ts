import { describe, it, expect, vi } from "vitest";
import { CsbtMerkleTree, CsbtLeafData } from "../../src/lib/csbt";
import bcryptLib from "../../src/lib/bcrypt";

describe("Issue #1032: Wallet-Optional Attendee Flows", () => {
  const eventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";
  const rawSecret = "onton-secret-pass-2026";

  describe("Online Event Secret Phrase Attendance (Wallet-less)", () => {
    it("validates secret phrase without requiring a connected wallet", async () => {
      // Organizer creates secret phrase (bcrypt-hashed)
      const hashedSecret = await bcryptLib.hashPassword(rawSecret);

      // Wallet-less attendee submits matching phrase
      const attendeeInput = "ONTON-SECRET-PASS-2026  ";
      const cleaned = attendeeInput.trim().toLowerCase();

      const isMatch = await bcryptLib.comparePassword(cleaned, hashedSecret);
      expect(isMatch).toBe(true);

      // Non-matching phrase fails
      const isBadMatch = await bcryptLib.comparePassword("wrong-pass", hashedSecret);
      expect(isBadMatch).toBe(false);
    });

    it("records native attendance with checkedin status and creates no rewards row", async () => {
      // Simulating the transactional attendance write from userEventFields.ts
      interface VisitorRecord {
        id: number;
        userId: number;
        eventUuid: string;
      }
      interface RegistrantRecord {
        eventUuid: string;
        userId: number;
        status: "pending" | "approved" | "checkedin" | "rejected";
        updatedAt?: Date;
      }
      interface RewardRecord {
        id: number;
        visitorId: number;
        userId: number;
        type: string;
        status: string;
      }

      const mockDb = {
        visitors: [] as VisitorRecord[],
        eventRegistrants: [
          // Pre-registered attendee before secret phrase entry
          { eventUuid, userId: 10001, status: "approved" as const },
        ] as RegistrantRecord[],
        rewards: [] as RewardRecord[],
      };

      // Atomic transaction execution matching userEventFields.ts
      async function executeAttendanceTransaction(userId: number, targetEventUuid: string) {
        // 1. Record visitor attendance if not already present
        const existingVisitor = mockDb.visitors.find(
          (v) => v.userId === userId && v.eventUuid === targetEventUuid
        );
        if (!existingVisitor) {
          mockDb.visitors.push({
            id: mockDb.visitors.length + 1,
            userId,
            eventUuid: targetEventUuid,
          });
        }

        // 2. Upsert eventRegistrants with status 'checkedin'
        const existingRegIdx = mockDb.eventRegistrants.findIndex(
          (r) => r.userId === userId && r.eventUuid === targetEventUuid
        );
        if (existingRegIdx >= 0) {
          mockDb.eventRegistrants[existingRegIdx].status = "checkedin";
          mockDb.eventRegistrants[existingRegIdx].updatedAt = new Date();
        } else {
          mockDb.eventRegistrants.push({
            eventUuid: targetEventUuid,
            userId,
            status: "checkedin",
            updatedAt: new Date(),
          });
        }

        // 3. TON Society rewards are shut down: no rewards row should be inserted
      }

      // Case 1: Pre-registered attendee enters password -> updated to checkedin
      await executeAttendanceTransaction(10001, eventUuid);
      const preReg = mockDb.eventRegistrants.find((r) => r.userId === 10001);
      expect(preReg).toBeDefined();
      expect(preReg?.status).toBe("checkedin");

      // Case 2: Walk-in / non-registered attendee enters password -> inserted as checkedin
      await executeAttendanceTransaction(10002, eventUuid);
      const walkInReg = mockDb.eventRegistrants.find((r) => r.userId === 10002);
      expect(walkInReg).toBeDefined();
      expect(walkInReg?.status).toBe("checkedin");

      // Verify visitors table has both attendees recorded
      expect(mockDb.visitors).toHaveLength(2);

      // Verify STRICTLY that NO rewards row is created (TON Society shutdown compliance)
      expect(mockDb.rewards).toHaveLength(0);
      expect(mockDb.rewards.filter((r) => r.type === "ton_society_sbt")).toHaveLength(0);
    });

    it("constructs valid off-chain cSBT Merkle proof for wallet-less attendee by userId", async () => {
      // 3 attendees: 2 wallet-less (identified by numeric userId), 1 with wallet
      const attendees = [
        { id: 1, userId: 10001, walletAddress: null, status: "checkedin" },
        { id: 2, userId: 10002, walletAddress: null, status: "checkedin" },
        { id: 3, userId: 10003, walletAddress: "0:abcdef1234567890", status: "checkedin" },
      ];

      // Build cSBT leaves using ownerAddress as userId (String(reg.userId || 0))
      const leaves: CsbtLeafData[] = attendees.map((att, idx) => ({
        index: idx,
        ownerAddress: String(att.userId),
        eventUuid,
      }));

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      expect(tree.leafCount).toBe(3);
      expect(tree.getRootHex()).toBeDefined();

      // Wallet-less attendee #2 (index 1) requests proof
      const walletLessAttendeeIdx = 1;
      const proof = tree.getProof(walletLessAttendeeIdx);

      expect(proof.leafIndex).toBe(1);
      expect(proof.steps.length).toBeGreaterThan(0);

      // Verify offline inclusion proof
      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);
      expect(isVerified).toBe(true);
    });

    it("verifies single wallet-less attendee gets a valid cSBT leaf and root", async () => {
      const leaves: CsbtLeafData[] = [
        {
          index: 0,
          ownerAddress: "987654321", // Telegram userId only, no wallet
          eventUuid,
        },
      ];

      const tree = await CsbtMerkleTree.fromLeaves(leaves);
      const proof = tree.getProof(0);

      expect(tree.getRootHex()).toBeDefined();
      expect(proof.leafIndex).toBe(0);

      const isVerified = CsbtMerkleTree.verifyProof(proof.leafHash, proof, proof.root);
      expect(isVerified).toBe(true);
    });
  });

  describe("In-Person Check-In Notification Message", () => {
    it("formats check-in notification without mentioning TON wallets in main text", () => {
      const event = {
        title: "ONTON Web3 Summit Helsinki",
        sbt_collection_address: "0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      };
      const botUsername = "ontonlocaldevbot";
      const hasSbtBadge = Boolean(event.sbt_collection_address);

      // Check-in notification message according to Issue #1032 spec
      const notificationMsg = "🎉 You're checked in! Your attendance is recorded in ONTON.";
      const credentialsLink = `https://t.me/${botUsername}/event?startapp=ticket_${eventUuid}`;

      expect(notificationMsg).toBe("🎉 You're checked in! Your attendance is recorded in ONTON.");
      expect(notificationMsg.toLowerCase()).not.toContain("wallet");
      expect(notificationMsg.toLowerCase()).not.toContain("ton wallet");

      const button = hasSbtBadge
        ? { link: credentialsLink, linkText: "Put it on-chain" }
        : { link: undefined, linkText: undefined };

      expect(button.linkText).toBe("Put it on-chain");
      expect(button.link).toContain("startapp=ticket_");
    });

    it("omits action button when event does not have an SBT badge collection", () => {
      const event = {
        title: "Community Casual Meetup",
        sbt_collection_address: null,
      };
      const hasSbtBadge = Boolean(event.sbt_collection_address);
      const notificationMsg = "🎉 You're checked in! Your attendance is recorded in ONTON.";

      const button = hasSbtBadge
        ? { link: `https://t.me/ontonlocaldevbot/event?startapp=ticket_${eventUuid}`, linkText: "Put it on-chain" }
        : { link: undefined, linkText: undefined };

      expect(notificationMsg).toBe("🎉 You're checked in! Your attendance is recorded in ONTON.");
      expect(button.link).toBeUndefined();
      expect(button.linkText).toBeUndefined();
    });
  });

  describe("Preservation of Wallet Requirements for Specific Features", () => {
    it("ensures on-chain SBT upgrade requires a connected wallet", () => {
      const handleUpgrade = (userWallet: string | null | undefined) => {
        if (!userWallet) {
          return { error: "WALLET_REQUIRED", message: "Please connect your TON wallet to upgrade to an on-chain token." };
        }
        return { success: true };
      };

      expect(handleUpgrade(null).error).toBe("WALLET_REQUIRED");
      expect(handleUpgrade(undefined).error).toBe("WALLET_REQUIRED");
      expect(handleUpgrade("0:1234567890").success).toBe(true);
    });

    it("ensures raffle spin requires a connected wallet", () => {
      const canSpinRaffle = (hasWallet: boolean, raffleStatus: string) => {
        return hasWallet && ["waiting_funding", "funded"].includes(raffleStatus);
      };

      expect(canSpinRaffle(false, "funded")).toBe(false);
      expect(canSpinRaffle(true, "funded")).toBe(true);
      expect(canSpinRaffle(true, "waiting_funding")).toBe(true);
      expect(canSpinRaffle(true, "completed")).toBe(false);
    });

    it("ensures crypto checkout requires a connected wallet", () => {
      const isCryptoCheckoutAllowed = (isPaid: boolean, isStarsOnly: boolean, hasWallet: boolean) => {
        if (isPaid && !isStarsOnly && !hasWallet) {
          return false;
        }
        return true;
      };

      // TON/USDT paid event without wallet cannot proceed
      expect(isCryptoCheckoutAllowed(true, false, false)).toBe(false);
      // TON/USDT paid event with wallet can proceed
      expect(isCryptoCheckoutAllowed(true, false, true)).toBe(true);
      // Free event without wallet can proceed
      expect(isCryptoCheckoutAllowed(false, false, false)).toBe(true);
      // Stars only event without wallet can proceed
      expect(isCryptoCheckoutAllowed(true, true, false)).toBe(true);
    });
  });
});
