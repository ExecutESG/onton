import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock DB chain
const mockDbExecute = vi.fn();
vi.mock("@/db/db", () => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: (...args: any[]) => mockDbExecute(...args),
  };
  return {
    db: chain,
    closeDB: vi.fn(),
  };
});

// Mock dependencies for sbt router and services
vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue(true),
    deleteCache: vi.fn().mockResolvedValue(true),
    cacheLvl: { short: 60, medium: 300, long: 3600 },
    cacheKeys: { user: "user:" },
  },
}));

vi.mock("@/server/config", () => ({
  config: {
    ONTON_WALLET_ADDRESS: "0:test_treasury_wallet_address_123",
  },
}));

vi.mock("@/server/utils/evnutils", () => ({
  is_local_env: vi.fn().mockReturnValue(true),
}));

vi.mock("@/services/tonCenter", () => ({
  default: {
    fetchAllTransactions: vi.fn().mockResolvedValue([]),
    parseTransactions: vi.fn().mockResolvedValue([]),
  },
  is_mainnet: false,
}));

vi.mock("@/db/modules/sbt.db", () => ({
  sbtDB: {
    findCollectionByEventUuid: vi.fn(),
    findUserSbtItemsWithEvent: vi.fn().mockResolvedValue([]),
    findUserSbtForEvent: vi.fn().mockResolvedValue(null),
    ensureSbtTables: vi.fn().mockResolvedValue(undefined),
  },
  default: {
    findCollectionByEventUuid: vi.fn(),
    findUserSbtItemsWithEvent: vi.fn().mockResolvedValue([]),
    findUserSbtForEvent: vi.fn().mockResolvedValue(null),
    ensureSbtTables: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/sbtService", () => ({
  sbtService: {
    mintSbtBadge: vi.fn().mockResolvedValue({
      itemAddress: "0:new_minted_sbt_address_999",
      collectionAddress: "0:collection_addr",
      itemIndex: 1,
    }),
    verifySbtOwnership: vi.fn().mockResolvedValue({ isOwner: true }),
  },
}));

vi.mock("@/db/modules/events.db", () => ({
  default: {
    fetchEventByUuid: vi.fn().mockResolvedValue({
      event_uuid: "11111111-1111-1111-1111-111111111111",
      title: "Test Web3 Summit",
      description: "A great conference",
      image_url: "https://onton.app/event.jpg",
      tsRewardImage: "https://onton.app/badge.png",
      start_date: 1774569600,
      end_date: 1774656000,
      location: "Helsinki",
      participationType: "in_person",
    }),
  },
}));

vi.mock("@/db/modules/users.db", () => ({
  usersDB: {
    selectUserById: vi.fn().mockResolvedValue({
      user_id: 100,
      wallet_address: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
    }),
    updateWallet: vi.fn().mockResolvedValue(true),
  },
  selectUserById: vi.fn().mockResolvedValue({
    user_id: 100,
    wallet_address: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
  }),
}));

import {
  determineLegacyKind,
  findUserLegacyAttendance,
  findRewardWithVisitor,
  updateRewardData,
  legacyAttendanceDB,
} from "../../src/db/modules/legacyAttendance.db";
import { sbtRouter } from "../../src/server/routers/sbt";
import { sbtDB } from "../../src/db/modules/sbt.db";
import { sbtService } from "../../src/services/sbtService";
import { is_local_env } from "../../src/server/utils/evnutils";
import tonCenter from "../../src/services/tonCenter";

describe("Legacy Attendance: Kind Mapping", () => {
  it("maps tonSocietyStatus CLAIMED to legacy_onchain", () => {
    expect(determineLegacyKind("CLAIMED", null)).toBe("legacy_onchain");
    expect(determineLegacyKind("CLAIMED", {})).toBe("legacy_onchain");
    expect(determineLegacyKind("CLAIMED", { reward_link: "https://example.com" })).toBe("legacy_onchain");
  });

  it("maps tonSocietyStatus RECEIVED to legacy_onchain", () => {
    expect(determineLegacyKind("RECEIVED", null)).toBe("legacy_onchain");
    expect(determineLegacyKind("RECEIVED", {})).toBe("legacy_onchain");
  });

  it("maps present sbt_address to legacy_onchain regardless of status", () => {
    expect(
      determineLegacyKind("NOT_CLAIMED", { sbt_address: "0:some_contract_address" })
    ).toBe("legacy_onchain");
    expect(
      determineLegacyKind("NOT_ELIGIBLE", { sbt_address: "0:some_contract_address" })
    ).toBe("legacy_onchain");
  });

  it("maps materialized_sbt_address to legacy_onchain", () => {
    expect(
      determineLegacyKind("NOT_CLAIMED", { materialized_sbt_address: "0:materialized_addr_123" })
    ).toBe("legacy_onchain");
  });

  it("maps NOT_CLAIMED without sbt_address or materialized address to legacy_record", () => {
    expect(determineLegacyKind("NOT_CLAIMED", null)).toBe("legacy_record");
    expect(determineLegacyKind("NOT_CLAIMED", {})).toBe("legacy_record");
    expect(
      determineLegacyKind("NOT_CLAIMED", {
        reward_link: "https://society.ton.org/claim/123",
        sbt_address: null,
      })
    ).toBe("legacy_record");
  });

  it("maps whitespace or empty sbt_address to legacy_record", () => {
    expect(determineLegacyKind("NOT_CLAIMED", { sbt_address: "  " })).toBe("legacy_record");
    expect(determineLegacyKind("NOT_CLAIMED", { materialized_sbt_address: "" })).toBe("legacy_record");
  });

  it("parses stringified JSON data safely", () => {
    const jsonStr = JSON.stringify({ sbt_address: "0:contract_address_123" });
    expect(determineLegacyKind("NOT_CLAIMED", jsonStr)).toBe("legacy_onchain");
    expect(determineLegacyKind("NOT_CLAIMED", "invalid json")).toBe("legacy_record");
  });
});

describe("Legacy Attendance: DB Module Validation & Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findRewardWithVisitor safely returns null for invalid UUID without throwing", async () => {
    const res1 = await findRewardWithVisitor("not-a-valid-uuid");
    expect(res1).toBeNull();
    const res2 = await findRewardWithVisitor("");
    expect(res2).toBeNull();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("updateRewardData safely returns null for invalid UUID without throwing", async () => {
    const res1 = await updateRewardData("malformed-id", { test: 1 });
    expect(res1).toBeNull();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("findUserLegacyAttendance deduplicates rows per event: prefers legacy_onchain", async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-03-01T10:00:00Z"),
        updatedAt: null,
        visitorId: 1,
        userId: 100,
        eventUuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        eventTitle: "Event Alpha",
        eventDescription: "Desc",
        eventImage: null,
        eventRewardImage: null,
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "Dubai",
        eventParticipationType: "online",
        sbtCollectionAddress: null,
      },
      {
        rewardId: "22222222-2222-2222-2222-222222222222",
        rewardType: "ton_society_sbt",
        rewardData: { sbt_address: "0:onchain_sbt_address" },
        status: "created",
        tonSocietyStatus: "CLAIMED",
        createdAt: new Date("2026-02-01T10:00:00Z"),
        updatedAt: null,
        visitorId: 2,
        userId: 100,
        eventUuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        eventTitle: "Event Alpha",
        eventDescription: "Desc",
        eventImage: null,
        eventRewardImage: null,
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "Dubai",
        eventParticipationType: "online",
        sbtCollectionAddress: null,
      },
    ]);

    const res = await findUserLegacyAttendance(100);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].rewardId).toBe("22222222-2222-2222-2222-222222222222");
    expect(res.items[0].kind).toBe("legacy_onchain");
    expect(res.totalCount).toBe(1);
  });

  it("findUserLegacyAttendance handles cursor pagination and returns empty on stale cursor", async () => {
    mockDbExecute.mockResolvedValue([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-03-01T10:00:00Z"),
        visitorId: 1,
        userId: 100,
        eventUuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        rewardId: "22222222-2222-2222-2222-222222222222",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-02-01T10:00:00Z"),
        visitorId: 2,
        userId: 100,
        eventUuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ]);

    // Page 1
    const page1 = await findUserLegacyAttendance(100, { limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].rewardId).toBe("11111111-1111-1111-1111-111111111111");
    expect(page1.nextCursor).toBeDefined();

    // Page 2
    const page2 = await findUserLegacyAttendance(100, { limit: 1, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].rewardId).toBe("22222222-2222-2222-2222-222222222222");
    expect(page2.nextCursor).toBeNull();

    // Stale or invalid cursor: returns empty array without looping
    const staleRes = await findUserLegacyAttendance(100, {
      cursor: Buffer.from(JSON.stringify({ id: "99999999-9999-9999-9999-999999999999" })).toString("base64"),
    });
    expect(staleRes.items).toEqual([]);
    expect(staleRes.nextCursor).toBeNull();
  });
});

describe("sbtRouter.getUserBadges: Integration, Overrides & Multi-Page Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createCaller = (user: any) =>
    sbtRouter.createCaller({
      user,
      req: {} as any,
    } as any);

  it("deduplicates so native TEP-85 badge overrides legacy attendance for the same eventUuid", async () => {
    vi.mocked(sbtDB.findUserSbtItemsWithEvent).mockResolvedValueOnce([
      {
        item: {
          id: 1,
          sbtCollectionId: 10,
          itemIndex: 0,
          itemAddress: "0:native_item_address_1",
          recipientUserId: 100,
          recipientWalletAddress: "0:user_wallet_100",
          metadataUrl: "https://meta.url/1",
          status: "minted",
          transactionHash: "tx1",
          revokedAt: null,
          metadata: { name: "Native Badge" },
          createdAt: new Date("2026-03-01"),
          updatedAt: new Date("2026-03-01"),
        },
        collection: {
          id: 10,
          eventUuid: "event-shared-123",
          collectionAddress: "0:collection_1",
          ownerAddress: "0:owner",
          authorityAddress: "0:auth",
          name: "Test Event Credentials",
          description: "Desc",
          image: "img",
          metadataUrl: "meta",
          commonContentUrl: "",
          nextItemIndex: 1,
          totalMinted: 1,
          status: "active",
          createdAt: new Date("2026-03-01"),
          updatedAt: new Date("2026-03-01"),
        },
        eventTitle: "Shared Event",
        eventImage: "https://onton.app/img.jpg",
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "London",
        eventParticipationType: "online",
      },
    ]);

    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-01-01"),
        updatedAt: null,
        visitorId: 1,
        userId: 100,
        eventUuid: "event-shared-123", // Duplicated with native!
        eventTitle: "Shared Event Legacy",
        eventDescription: "Desc",
        eventImage: "https://onton.app/img.jpg",
        eventRewardImage: null,
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "London",
        eventParticipationType: "online",
        sbtCollectionAddress: null,
      },
      {
        rewardId: "22222222-2222-2222-2222-222222222222",
        rewardType: "ton_society_sbt",
        rewardData: { sbt_address: "0:legacy_onchain_addr" },
        status: "created",
        tonSocietyStatus: "CLAIMED",
        createdAt: new Date("2026-02-01"),
        updatedAt: null,
        visitorId: 2,
        userId: 100,
        eventUuid: "event-unique-456", // Unique legacy
        eventTitle: "Unique Legacy Event",
        eventDescription: "Desc",
        eventImage: "https://onton.app/img2.jpg",
        eventRewardImage: null,
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "Berlin",
        eventParticipationType: "in_person",
        sbtCollectionAddress: null,
      },
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.getUserBadges({ userId: 100 });

    expect(res.badges).toHaveLength(2);
    expect(res.totalCount).toBe(2);

    const nativeBadge = res.badges.find((b) => b.eventUuid === "event-shared-123");
    expect(nativeBadge).toBeDefined();
    expect(nativeBadge?.kind).toBe("native_sbt");
    expect(nativeBadge?.canUpgrade).toBe(false);

    const legacyBadge = res.badges.find((b) => b.eventUuid === "event-unique-456");
    expect(legacyBadge).toBeDefined();
    expect(legacyBadge?.kind).toBe("legacy_onchain");
    expect(legacyBadge?.canUpgrade).toBe(false);
    expect(legacyBadge?.rewardId).toBe("22222222-2222-2222-2222-222222222222");

    // The legacy record for the shared event must NOT be in the results
    expect(res.badges.some((b) => b.id === "ts_11111111-1111-1111-1111-111111111111")).toBe(false);
  });

  it("correctly flags legacy_record with canUpgrade: true and passes rewardId", async () => {
    vi.mocked(sbtDB.findUserSbtItemsWithEvent).mockResolvedValueOnce([]);
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "33333333-3333-3333-3333-333333333333",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-01-15"),
        updatedAt: null,
        visitorId: 5,
        userId: 100,
        eventUuid: "event-upgrade-789",
        eventTitle: "Hackathon Attendee",
        eventDescription: "Proof of attendance",
        eventImage: "https://onton.app/img.jpg",
        eventRewardImage: null,
        eventStartDate: 1774569600,
        eventEndDate: 1774656000,
        eventLocation: "Paris",
        eventParticipationType: "in_person",
        sbtCollectionAddress: null,
      },
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.getUserBadges({ userId: 100 });

    expect(res.badges).toHaveLength(1);
    const badge = res.badges[0];
    expect(badge.kind).toBe("legacy_record");
    expect(badge.canUpgrade).toBe(true);
    expect(badge.rewardId).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("paginates combined badges cleanly across multiple pages using cursors", async () => {
    // 3 native badges
    const mockNative = [
      {
        item: {
          id: 101,
          sbtCollectionId: 1,
          itemIndex: 0,
          itemAddress: "0:item_1",
          recipientUserId: 100,
          status: "minted",
          createdAt: new Date("2026-05-01"),
        },
        collection: { eventUuid: "event-nat-1", name: "Nat 1" },
        eventTitle: "Event Nat 1",
        eventStartDate: 1777500000,
      },
      {
        item: {
          id: 102,
          sbtCollectionId: 2,
          itemIndex: 0,
          itemAddress: "0:item_2",
          recipientUserId: 100,
          status: "minted",
          createdAt: new Date("2026-04-01"),
        },
        collection: { eventUuid: "event-nat-2", name: "Nat 2" },
        eventTitle: "Event Nat 2",
        eventStartDate: 1774800000,
      },
    ];

    // 2 legacy badges
    const mockLegacy = [
      {
        rewardId: "44444444-4444-4444-4444-444444444444",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-03-01"),
        visitorId: 10,
        userId: 100,
        eventUuid: "event-leg-1",
        eventTitle: "Event Leg 1",
        eventStartDate: 1772100000,
      },
      {
        rewardId: "55555555-5555-5555-5555-555555555555",
        rewardType: "ton_society_sbt",
        rewardData: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        createdAt: new Date("2026-02-01"),
        visitorId: 11,
        userId: 100,
        eventUuid: "event-leg-2",
        eventTitle: "Event Leg 2",
        eventStartDate: 1769500000,
      },
    ];

    vi.mocked(sbtDB.findUserSbtItemsWithEvent).mockResolvedValue(mockNative as any);
    mockDbExecute.mockResolvedValue(mockLegacy);

    const caller = createCaller({ user_id: 100, role: "user" });

    // Page 1: limit 2
    const page1 = await caller.getUserBadges({ userId: 100, limit: 2 });
    expect(page1.badges).toHaveLength(2);
    expect(page1.totalCount).toBe(4);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2: limit 2 with cursor from Page 1
    const page2 = await caller.getUserBadges({ userId: 100, limit: 2, cursor: page1.nextCursor });
    expect(page2.badges).toHaveLength(2);
    expect(page2.totalCount).toBe(4);
    expect(page2.nextCursor).toBeNull(); // No more items

    // Stale or nonexistent cursor: returns empty badges and null nextCursor without infinite loop
    const stalePage = await caller.getUserBadges({ userId: 100, limit: 2, cursor: "invalid-stale-cursor" });
    expect(stalePage.badges).toEqual([]);
    expect(stalePage.nextCursor).toBeNull();
    expect(stalePage.totalCount).toBe(4);
  });
});

describe("sbtRouter.materializeLegacyRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(is_local_env).mockReturnValue(true);
  });

  const createCaller = (user: any) =>
    sbtRouter.createCaller({
      user,
      req: {} as any,
    } as any);

  it("rejects unauthorized caller when no user session is present", async () => {
    const unauthCaller = createCaller(null);
    await expect(
      unauthCaller.materializeLegacyRecord({ rewardId: "11111111-1111-1111-1111-111111111111" })
    ).rejects.toThrowError(TRPCError);
  });

  it("rejects when reward record is not found or invalid UUID", async () => {
    const caller = createCaller({ user_id: 100, role: "user" });
    await expect(
      caller.materializeLegacyRecord({ rewardId: "nonexistent-id" })
    ).rejects.toThrowError(/not found/i);
  });

  it("rejects non-owner with FORBIDDEN", async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        visitorId: 10,
        userId: 200, // owned by user 200!
        eventUuid: "11111111-1111-1111-1111-111111111111",
        data: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        type: "ton_society_sbt",
        createdAt: new Date(),
        updatedAt: null,
      },
    ]);

    // Caller is user 100 (not 200!)
    const caller = createCaller({ user_id: 100, role: "user" });
    await expect(
      caller.materializeLegacyRecord({ rewardId: "11111111-1111-1111-1111-111111111111" })
    ).rejects.toThrowError(/do not own/i);
  });

  it("rejects invalid recipient wallet address with BAD_REQUEST", async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        visitorId: 10,
        userId: 100,
        eventUuid: "11111111-1111-1111-1111-111111111111",
        data: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        type: "ton_society_sbt",
        createdAt: new Date(),
        updatedAt: null,
      },
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    await expect(
      caller.materializeLegacyRecord({
        rewardId: "11111111-1111-1111-1111-111111111111",
        walletAddress: "not-a-valid-ton-address",
      })
    ).rejects.toThrowError(/invalid recipient wallet/i);
  });

  it("rejects double minting: returns existing if materialized_sbt_address is present", async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        visitorId: 10,
        userId: 100,
        eventUuid: "11111111-1111-1111-1111-111111111111",
        data: {
          materialized_sbt_address: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
        },
        status: "created",
        tonSocietyStatus: "CLAIMED",
        type: "ton_society_sbt",
        createdAt: new Date(),
        updatedAt: null,
      },
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.materializeLegacyRecord({ rewardId: "11111111-1111-1111-1111-111111111111" });

    expect(res.success).toBe(true);
    expect(res.isExisting).toBe(true);
    expect(res.itemAddress).toBe("0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620");
    expect(sbtService.mintSbtBadge).not.toHaveBeenCalled();
  });

  it("rejects double minting: returns existing if sbt_address is present", async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        visitorId: 10,
        userId: 100,
        eventUuid: "11111111-1111-1111-1111-111111111111",
        data: {
          sbt_address: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
        },
        status: "created",
        tonSocietyStatus: "CLAIMED",
        type: "ton_society_sbt",
        createdAt: new Date(),
        updatedAt: null,
      },
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.materializeLegacyRecord({ rewardId: "11111111-1111-1111-1111-111111111111" });

    expect(res.success).toBe(true);
    expect(res.isExisting).toBe(true);
    expect(res.itemAddress).toBe("0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620");
    expect(sbtService.mintSbtBadge).not.toHaveBeenCalled();
  });

  it("rejects double minting: returns existing if sbtDB already has minted SBT for user + event", async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        {
          rewardId: "11111111-1111-1111-1111-111111111111",
          visitorId: 10,
          userId: 100,
          eventUuid: "event-xyz",
          data: {},
          status: "created",
          tonSocietyStatus: "NOT_CLAIMED",
          type: "ton_society_sbt",
          createdAt: new Date(),
          updatedAt: null,
        },
      ])
      .mockResolvedValueOnce([{}]); // updateRewardData returning

    vi.mocked(sbtDB.findUserSbtForEvent).mockResolvedValueOnce({
      id: 55,
      sbtCollectionId: 1,
      itemIndex: 0,
      itemAddress: "0:db_existing_sbt_address",
      recipientUserId: 100,
      recipientWalletAddress: "0:wallet",
      metadataUrl: "meta",
      status: "minted",
      transactionHash: null,
      revokedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.materializeLegacyRecord({ rewardId: "11111111-1111-1111-1111-111111111111" });

    expect(res.success).toBe(true);
    expect(res.isExisting).toBe(true);
    expect(res.itemAddress).toBe("0:db_existing_sbt_address");
    expect(sbtService.mintSbtBadge).not.toHaveBeenCalled();
  });

  it("in non-local environment: rejects when payment is missing", async () => {
    vi.mocked(is_local_env).mockReturnValue(false);

    mockDbExecute.mockResolvedValueOnce([
      {
        rewardId: "11111111-1111-1111-1111-111111111111",
        visitorId: 12,
        userId: 100,
        eventUuid: "11111111-1111-1111-1111-111111111111",
        data: {},
        status: "created",
        tonSocietyStatus: "NOT_CLAIMED",
        type: "ton_society_sbt",
        createdAt: new Date(),
        updatedAt: null,
      },
    ]);

    vi.mocked(sbtDB.findUserSbtForEvent).mockResolvedValueOnce(null);
    vi.mocked(tonCenter.fetchAllTransactions).mockResolvedValue([]);
    vi.mocked(tonCenter.parseTransactions).mockResolvedValue([]);

    const caller = createCaller({ user_id: 100, role: "user" });
    await expect(
      caller.materializeLegacyRecord({
        rewardId: "11111111-1111-1111-1111-111111111111",
        walletAddress: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
      })
    ).rejects.toThrowError(/Payment transaction of 0.1 TON not found/i);
  });

  it("in non-local environment: verifies payment transaction and mints SBT", async () => {
    vi.mocked(is_local_env).mockReturnValue(false);

    mockDbExecute
      .mockResolvedValueOnce([
        {
          rewardId: "11111111-1111-1111-1111-111111111111",
          visitorId: 12,
          userId: 100,
          eventUuid: "11111111-1111-1111-1111-111111111111",
          data: {},
          status: "created",
          tonSocietyStatus: "NOT_CLAIMED",
          type: "ton_society_sbt",
          createdAt: new Date(),
          updatedAt: null,
        },
      ])
      .mockResolvedValueOnce([{}]); // updateRewardData returning

    vi.mocked(sbtDB.findUserSbtForEvent).mockResolvedValueOnce(null);
    vi.mocked(tonCenter.fetchAllTransactions).mockResolvedValueOnce([{} as any]);
    vi.mocked(tonCenter.parseTransactions).mockResolvedValueOnce([
      {
        order_uuid: "11111111-1111-1111-1111-111111111111",
        rawAmount: BigInt(100_000_000), // 0.1 TON
        kind: "ton",
        verfied: true,
      } as any,
    ]);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.materializeLegacyRecord({
      rewardId: "11111111-1111-1111-1111-111111111111",
      walletAddress: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
    });

    expect(res.success).toBe(true);
    expect(res.isExisting).toBe(false);
    expect(res.itemAddress).toBe("0:new_minted_sbt_address_999");
    expect(sbtService.mintSbtBadge).toHaveBeenCalled();
  });

  it("successfully mints native TEP-85 SBT and updates rewards.data in local environment", async () => {
    mockDbExecute
      .mockResolvedValueOnce([
        {
          rewardId: "11111111-1111-1111-1111-111111111111",
          visitorId: 12,
          userId: 100,
          eventUuid: "11111111-1111-1111-1111-111111111111",
          data: { reward_link: "https://society.ton.org/claim/abc" },
          status: "created",
          tonSocietyStatus: "NOT_CLAIMED",
          type: "ton_society_sbt",
          createdAt: new Date(),
          updatedAt: null,
        },
      ])
      .mockResolvedValueOnce([{}]); // updateRewardData returning

    vi.mocked(sbtDB.findUserSbtForEvent).mockResolvedValueOnce(null);

    const caller = createCaller({ user_id: 100, role: "user" });
    const res = await caller.materializeLegacyRecord({
      rewardId: "11111111-1111-1111-1111-111111111111",
      walletAddress: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
    });

    expect(res.success).toBe(true);
    expect(res.isExisting).toBe(false);
    expect(res.itemAddress).toBe("0:new_minted_sbt_address_999");
    expect(res.explorerUrl).toContain("0:new_minted_sbt_address_999");

    // Verified that mintSbtBadge was called with target wallet and event uuid
    expect(sbtService.mintSbtBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        eventUuid: "11111111-1111-1111-1111-111111111111",
        userId: 100,
        walletAddress: "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620",
        badgeTitle: "Test Web3 Summit Attendance Badge",
      })
    );
  });
});
