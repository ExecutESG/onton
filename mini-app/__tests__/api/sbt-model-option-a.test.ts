import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment secrets for fail-fast
process.env.AUTH_JWT_SECRET = "a".repeat(16) + "0123456789abcdef";
process.env.TOTP_SECRET = "b".repeat(16) + "0123456789abcdef";
process.env.ONTON_API_SECRET = "c".repeat(16) + "0123456789abcdef";
process.env.BOT_API_HMAC_SECRET = "d".repeat(16) + "0123456789abcdef";

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("@/services/sbtService", () => ({
  sbtService: {
    mintSbtBadge: vi.fn().mockResolvedValue({
      id: 1,
      itemAddress: "0:sbt_item_address_mock",
    }),
  },
}));

vi.mock("@/services/tonCenter", () => ({
  default: {
    fetchAllTransactions: vi.fn(),
    parseTransactions: vi.fn(),
  },
  is_mainnet: true,
}));

vi.mock("@/server/config", () => ({
  config: {
    ONTON_WALLET_ADDRESS: "0:treasury_wallet_mock",
  },
}));

vi.mock("@/db/modules/ticket.db", () => ({
  default: {
    getTicketByUuid: vi.fn(),
  },
}));

vi.mock("@/db/modules/events.db", () => ({
  default: {
    fetchEventByUuid: vi.fn(),
  },
}));

vi.mock("@/db/modules/visitors.db", () => ({
  default: {
    addVisitor: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock("@/db/modules/users.db", () => ({
  usersDB: {
    updateWallet: vi.fn().mockResolvedValue(true),
    selectUserById: vi.fn(),
  },
}));

vi.mock("@/db/modules/sbt.db", () => ({
  sbtDB: {
    findUserSbtForEvent: vi.fn().mockResolvedValue(null),
  },
}));

import { sbtRouter } from "@/server/routers/sbt";
import tonCenter from "@/services/tonCenter";
import ticketDB from "@/db/modules/ticket.db";
import eventDB from "@/db/modules/events.db";
import visitorsDB from "@/db/modules/visitors.db";
import { sbtService } from "@/services/sbtService";
import { db } from "@/db/db";

describe("Issue #1060: F-36 SBT Model — Option A Enforcement", () => {
  const mockTicketUuid = "ticket-uuid-111";
  const mockEventUuid = "event-uuid-222";
  const mockUserId = 777;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(ticketDB, "getTicketByUuid").mockResolvedValue({
      id: 1,
      uuid: mockTicketUuid,
      event_uuid: mockEventUuid,
      user_id: mockUserId,
      status: "USED",
    } as any);

    vi.spyOn(eventDB, "fetchEventByUuid").mockResolvedValue({
      id: 1,
      event_uuid: mockEventUuid,
      title: "ONTON Conference 2026",
      start_date: 1700000000,
      end_date: 1800000000,
      image_url: "https://onton.app/banner.png",
    } as any);
  });

  describe("claimAttendanceSbt (Free Path)", () => {
    it("returns off-chain cSBT credential and DOES NOT call sbtService.mintSbtBadge", async () => {
      const caller = sbtRouter.createCaller({
        user: { user_id: mockUserId, role: "user" },
      } as any);

      const result = await caller.claimAttendanceSbt({
        ticketUuid: mockTicketUuid,
        walletAddress: "0:test_wallet",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("offchain_csbt");
      expect(result.badgeTitle).toBe("ONTON Conference 2026 Attendance Credential");
      expect(result.eventUuid).toBe(mockEventUuid);

      // CRITICAL ASSERTION for Option A: on-chain minting MUST NOT be called!
      expect(sbtService.mintSbtBadge).not.toHaveBeenCalled();

      // Attendance visitor record MUST be written
      expect(visitorsDB.addVisitor).toHaveBeenCalledWith(mockUserId, mockEventUuid);
    });

    it("rejects claim if ticket status is not USED", async () => {
      vi.spyOn(ticketDB, "getTicketByUuid").mockResolvedValueOnce({
        id: 1,
        uuid: mockTicketUuid,
        event_uuid: mockEventUuid,
        user_id: mockUserId,
        status: "UNUSED",
      } as any);

      const caller = sbtRouter.createCaller({
        user: { user_id: mockUserId, role: "user" },
      } as any);

      await expect(
        caller.claimAttendanceSbt({
          ticketUuid: mockTicketUuid,
        })
      ).rejects.toThrow(/Ticket must be checked in/);
    });
  });

  describe("materializeOnChainSbt (Paid Path)", () => {
    beforeEach(() => {
      process.env.ENV = "staging";
    });

    it("rejects when payment transaction has null or empty hash", async () => {
      vi.spyOn(tonCenter, "fetchAllTransactions").mockResolvedValue([{}] as any);
      vi.spyOn(tonCenter, "parseTransactions").mockResolvedValue([
        {
          order_uuid: mockTicketUuid,
          rawAmount: BigInt(100_000_000),
          trx_hash: "",
          kind: "ton",
          verfied: true,
          owner: {} as any,
        },
      ]);

      const caller = sbtRouter.createCaller({
        user: { user_id: mockUserId, role: "user" },
      } as any);

      await expect(
        caller.materializeOnChainSbt({
          ticketUuid: mockTicketUuid,
          walletAddress: "0:buyer_wallet",
        })
      ).rejects.toThrow(/Valid payment transaction hash is required/);
    });

    it("rejects reuse of payment transaction hash (anti-replay pre-check returns CONFLICT)", async () => {
      vi.spyOn(tonCenter, "fetchAllTransactions").mockResolvedValue([{}] as any);
      vi.spyOn(tonCenter, "parseTransactions").mockResolvedValue([
        {
          order_uuid: mockTicketUuid,
          rawAmount: BigInt(100_000_000),
          trx_hash: "used_payment_hash_123",
          kind: "ton",
          verfied: true,
          owner: {} as any,
        },
      ]);

      // Simulate that paymentTxHash was already used by another sbt_item
      vi.spyOn(db, "select").mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: 42 }]), // already exists!
          }),
        }),
      } as any);

      const caller = sbtRouter.createCaller({
        user: { user_id: mockUserId, role: "user" },
      } as any);

      try {
        await caller.materializeOnChainSbt({
          ticketUuid: mockTicketUuid,
          walletAddress: "0:buyer_wallet",
        });
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("already been used");
      }
    });

    it("catches 23505 unique constraint violation and returns CONFLICT", async () => {
      vi.spyOn(tonCenter, "fetchAllTransactions").mockResolvedValue([{}] as any);
      vi.spyOn(tonCenter, "parseTransactions").mockResolvedValue([
        {
          order_uuid: mockTicketUuid,
          rawAmount: BigInt(100_000_000),
          trx_hash: "race_payment_hash_456",
          kind: "ton",
          verfied: true,
          owner: {} as any,
        },
      ]);

      // Pre-check finds nothing (race condition simulation)
      vi.spyOn(db, "select").mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any);

      // Mint throws Postgres unique constraint error (code 23505)
      vi.spyOn(sbtService, "mintSbtBadge").mockRejectedValueOnce(
        Object.assign(new Error("duplicate key value violates unique constraint 'sbt_items_payment_tx_hash_uq'"), {
          code: "23505",
        })
      );

      const caller = sbtRouter.createCaller({
        user: { user_id: mockUserId, role: "user" },
      } as any);

      try {
        await caller.materializeOnChainSbt({
          ticketUuid: mockTicketUuid,
          walletAddress: "0:buyer_wallet",
        });
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("CONFLICT");
        expect(err.message).toContain("already been used");
      }
    });
  });
});
