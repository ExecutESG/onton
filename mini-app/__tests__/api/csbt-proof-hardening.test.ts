import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock environment secrets for fail-fast
process.env.AUTH_JWT_SECRET = "a".repeat(16) + "0123456789abcdef";
process.env.TOTP_SECRET = "b".repeat(16) + "0123456789abcdef";
process.env.ONTON_API_SECRET = "c".repeat(16) + "0123456789abcdef";
process.env.BOT_API_HMAC_SECRET = "d".repeat(16) + "0123456789abcdef";

const cacheStore = new Map<string, any>();
vi.mock("@/lib/redisTools", () => ({
  getCache: vi.fn(async (key: string) => cacheStore.get(key)),
  setCache: vi.fn(async (key: string, val: any) => cacheStore.set(key, val)),
  deleteCache: vi.fn(async (key: string) => cacheStore.delete(key)),
  redisTools: {
    getCache: vi.fn(async (key: string) => cacheStore.get(key)),
    setCache: vi.fn(async (key: string, val: any) => cacheStore.set(key, val)),
    deleteCache: vi.fn(async (key: string) => cacheStore.delete(key)),
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

import { GET as proofApiGet } from "@/app/api/v1/csbt/proof/route";
import eventDB from "@/db/modules/events.db";
import { csbtTreeService } from "@/services/csbtTreeService";
import { db } from "@/db/db";

describe("Issue #1059: /api/v1/csbt/proof Hardening & Privacy Protection", () => {
  const mockEventUuid = "99999999-9999-9999-9999-999999999999";

  beforeEach(() => {
    cacheStore.clear();
    vi.restoreAllMocks();

    vi.spyOn(eventDB, "fetchEventByUuid").mockResolvedValue({
      id: 1,
      event_uuid: mockEventUuid,
      title: "Hardened Test Event",
      start_date: 1700000000,
      end_date: 1800000000,
    } as any);

    vi.spyOn(csbtTreeService, "getFrozenTree").mockResolvedValue(null);
  });

  it("returns 404 not_a_member when requester provides no userId and no walletAddress", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}`
    );
    const res = await proofApiGet(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("not_a_member");
  });

  it("returns 404 not_a_member when event has zero checked-in attendees (no synthetic leaf)", async () => {
    vi.spyOn(db, "select").mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        leftJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([]), // empty attendees
          }),
        }),
      }),
    } as any);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}&userId=123`
    );
    const res = await proofApiGet(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("not_a_member");
  });

  it("returns 404 not_a_member when requester userId/wallet is not in checked-in list", async () => {
    vi.spyOn(db, "select").mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        leftJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([
              { id: 1, registrantUuid: "r-1", userId: 100, walletAddress: "0:aaa" },
              { id: 2, registrantUuid: "r-2", userId: 200, walletAddress: "0:bbb" },
            ]),
          }),
        }),
      }),
    } as any);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}&userId=999`
    );
    const res = await proofApiGet(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("not_a_member");
  });

  it("returns 404 not_a_member when leafIndex parameter does not match requester's own leaf", async () => {
    vi.spyOn(db, "select").mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        leftJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([
              { id: 1, registrantUuid: "r-1", userId: 100, walletAddress: "0:aaa" }, // index 0
              { id: 2, registrantUuid: "r-2", userId: 200, walletAddress: "0:bbb" }, // index 1
            ]),
          }),
        }),
      }),
    } as any);

    // Requester is userId 100 (index 0), but asks for leafIndex 1
    const req = new NextRequest(
      `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}&userId=100&leafIndex=1`
    );
    const res = await proofApiGet(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("not_a_member");
  });

  it("returns proof with proofValid: true and isMember: true for verified member and caches tree in Redis", async () => {
    vi.spyOn(db, "select").mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        leftJoin: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockResolvedValueOnce([
              { id: 1, registrantUuid: "r-1", userId: 100, walletAddress: "0:aaa" },
              { id: 2, registrantUuid: "r-2", userId: 200, walletAddress: "0:bbb" },
            ]),
          }),
        }),
      }),
    } as any);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/csbt/proof?eventUuid=${mockEventUuid}&userId=200`
    );
    const res = await proofApiGet(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isMember).toBe(true);
    expect(body.proofValid).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.leafIndex).toBe(1);
    expect(body.metadata.ownerIdentifier).toBe("0:bbb");

    // Verify Redis cache key was set
    const expectedCacheKey = `csbt:live_tree:${mockEventUuid}:2`;
    expect(cacheStore.has(expectedCacheKey)).toBe(true);
    const cachedData = cacheStore.get(expectedCacheKey);
    expect(cachedData.leaves.length).toBe(2);
    expect(cachedData.leafHashesHex.length).toBe(2);
  });
});
