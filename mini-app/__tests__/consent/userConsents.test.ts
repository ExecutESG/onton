import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

interface MockConsentRecord {
  id: number;
  user_id: number;
  purpose: string;
  policy_version: string;
  granted_at: Date;
  revoked_at: Date | null;
}

const { mockConsentsTable } = vi.hoisted(() => ({
  mockConsentsTable: [] as MockConsentRecord[],
}));

function extractPurposeFromSql(sqlObj: any): string | null {
  if (!sqlObj) return null;
  if (typeof sqlObj.value === "string" && CONSENT_PURPOSES.includes(sqlObj.value as any)) {
    return sqlObj.value;
  }
  if (Array.isArray(sqlObj.queryChunks)) {
    for (const chunk of sqlObj.queryChunks) {
      const found = extractPurposeFromSql(chunk);
      if (found) return found;
    }
  }
  return null;
}

vi.mock("@/db/db", () => ({
  db: {
    query: {
      user_consents: {
        findFirst: vi.fn().mockImplementation(({ where }: any) => {
          const targetPurpose = extractPurposeFromSql(where);
          for (const rec of mockConsentsTable) {
            if (rec.revoked_at === null && (!targetPurpose || rec.purpose === targetPurpose)) {
              return rec;
            }
          }
          return null;
        }),
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          return [...mockConsentsTable];
        }),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((values: any[]) => ({
        onConflictDoUpdate: vi.fn().mockImplementation(({ set }: any) => ({
          returning: vi.fn().mockImplementation(() => {
            const results: MockConsentRecord[] = [];
            for (const val of values) {
              const existingIdx = mockConsentsTable.findIndex(
                (c) =>
                  c.user_id === val.user_id &&
                  c.purpose === val.purpose &&
                  c.policy_version === val.policy_version
              );
              if (existingIdx >= 0) {
                mockConsentsTable[existingIdx] = {
                  ...mockConsentsTable[existingIdx],
                  revoked_at: set.revoked_at !== undefined ? set.revoked_at : mockConsentsTable[existingIdx].revoked_at,
                  granted_at: set.granted_at || mockConsentsTable[existingIdx].granted_at,
                };
                results.push(mockConsentsTable[existingIdx]);
              } else {
                const newRec: MockConsentRecord = {
                  id: mockConsentsTable.length + 1,
                  user_id: val.user_id,
                  purpose: val.purpose,
                  policy_version: val.policy_version,
                  granted_at: val.granted_at || new Date(),
                  revoked_at: val.revoked_at || null,
                };
                mockConsentsTable.push(newRec);
                results.push(newRec);
              }
            }
            return results;
          }),
        })),
        returning: vi.fn().mockImplementation(() => {
          const results: MockConsentRecord[] = [];
          for (const val of values) {
            const newRec: MockConsentRecord = {
              id: mockConsentsTable.length + 1,
              user_id: val.user_id,
              purpose: val.purpose,
              policy_version: val.policy_version,
              granted_at: val.granted_at || new Date(),
              revoked_at: val.revoked_at || null,
            };
            mockConsentsTable.push(newRec);
            results.push(newRec);
          }
          return results;
        }),
      })),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((setValues: any) => ({
        where: vi.fn().mockImplementation((whereClause: any) => ({
          returning: vi.fn().mockImplementation(() => {
            const targetPurpose = extractPurposeFromSql(whereClause);
            const updated: MockConsentRecord[] = [];
            for (let i = 0; i < mockConsentsTable.length; i++) {
              const rec = mockConsentsTable[i];
              if ((!targetPurpose || rec.purpose === targetPurpose) && rec.revoked_at === null) {
                mockConsentsTable[i] = {
                  ...rec,
                  revoked_at: setValues.revoked_at,
                };
                updated.push(mockConsentsTable[i]);
              }
            }
            return updated;
          }),
        })),
      })),
    }),
  },
}));

import {
  hasConsent,
  grantConsents,
  revokeConsent,
  getUserConsents,
  CONSENT_PURPOSES,
  CURRENT_PRIVACY_POLICY_VERSION,
} from "@/db/modules/userConsents.db";
import { consentsRouter } from "@/server/routers/consents";
import { db } from "@/db/db";

describe("GDPR User Consents Foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsentsTable.length = 0;
  });

  describe("Constants & Purpose enum", () => {
    it("exports all 3 required consent purposes", () => {
      expect(CONSENT_PURPOSES).toEqual([
        "audience_reach",
        "sponsor_stats",
        "attendance_verification_api",
      ]);
    });

    it("exports CURRENT_PRIVACY_POLICY_VERSION", () => {
      expect(CURRENT_PRIVACY_POLICY_VERSION).toBe("2024-09-11");
    });
  });

  describe("hasConsent helper", () => {
    it("returns false if user has no consent record", async () => {
      vi.mocked(db.query.user_consents.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await hasConsent(12345, "audience_reach");
      expect(result).toBe(false);
    });

    it("returns true if user has an active unrevoked consent", async () => {
      vi.mocked(db.query.user_consents.findFirst).mockResolvedValueOnce({
        id: 1,
        user_id: 12345,
        purpose: "audience_reach",
        policy_version: "2024-09-11",
        granted_at: new Date(),
        revoked_at: null,
      } as any);

      const result = await hasConsent(12345, "audience_reach");
      expect(result).toBe(true);
    });

    it("returns false if consent is revoked (revoked_at is not null)", async () => {
      // Drizzle where condition includes isNull(revoked_at), so db returns undefined
      vi.mocked(db.query.user_consents.findFirst).mockResolvedValueOnce(undefined as any);

      const result = await hasConsent(12345, "audience_reach");
      expect(result).toBe(false);
    });

    it("returns false for invalid user IDs (0, NaN)", async () => {
      expect(await hasConsent(0, "audience_reach")).toBe(false);
      expect(await hasConsent(NaN, "audience_reach")).toBe(false);
    });
  });

  describe("Grant & Revoke round trip", () => {
    it("grant creates active consent records and revoke cancels them immediately", async () => {
      const userId = 1001;

      // 1. Initially no consent
      expect(mockConsentsTable.length).toBe(0);

      // 2. Grant 2 purposes
      const granted = await grantConsents(userId, [
        "audience_reach",
        "sponsor_stats",
      ]);
      expect(granted.length).toBe(2);
      expect(mockConsentsTable.length).toBe(2);
      expect(mockConsentsTable.every((c) => c.revoked_at === null)).toBe(true);

      // 3. Revoke one purpose
      const revoked = await revokeConsent(userId, "audience_reach");
      expect(revoked.length).toBeGreaterThan(0);
      expect(revoked[0].revoked_at).not.toBeNull();

      // sponsor_stats should still be active
      const sponsorActive = await hasConsent(userId, "sponsor_stats");
      expect(sponsorActive).toBe(true);

      // audience_reach should now return false immediately
      const reachActive = await hasConsent(userId, "audience_reach");
      expect(reachActive).toBe(false);
    });

    it("re-granting a revoked consent reactivates it with revoked_at = null", async () => {
      const userId = 2002;

      // Initial grant
      await grantConsents(userId, ["attendance_verification_api"]);
      expect(mockConsentsTable[0].revoked_at).toBeNull();

      // Revoke
      await revokeConsent(userId, "attendance_verification_api");
      expect(mockConsentsTable[0].revoked_at).not.toBeNull();

      // Re-grant under same policy version
      await grantConsents(userId, ["attendance_verification_api"]);
      expect(mockConsentsTable[0].revoked_at).toBeNull();
    });
  });

  describe("tRPC consentsRouter input validation & procedures", () => {
    const callerMockUser = {
      user_id: 8888,
      role: "user",
      first_name: "Test",
    };

    const createCaller = (user: any) =>
      consentsRouter.createCaller({
        user,
        req: {} as any,
      } as any);

    it("getMine returns user active consents, purpose map and policy version", async () => {
      mockConsentsTable.push(
        {
          id: 1,
          user_id: 8888,
          purpose: "audience_reach",
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          granted_at: new Date(),
          revoked_at: null,
        },
        {
          id: 2,
          user_id: 8888,
          purpose: "sponsor_stats",
          policy_version: CURRENT_PRIVACY_POLICY_VERSION,
          granted_at: new Date(),
          revoked_at: new Date(), // revoked!
        }
      );

      const caller = createCaller(callerMockUser);
      const res = await caller.getMine();

      expect(res.policyVersion).toBe(CURRENT_PRIVACY_POLICY_VERSION);
      expect(res.activePurposes).toEqual(["audience_reach"]);
      expect(res.consents.audience_reach).toBe(true);
      expect(res.consents.sponsor_stats).toBe(false);
      expect(res.consents.attendance_verification_api).toBe(false);
      expect(res.records.length).toBe(2);
    });

    it("grant validates purpose enum and accepts valid list", async () => {
      const caller = createCaller(callerMockUser);
      const res = await caller.grant({
        purposes: ["audience_reach", "attendance_verification_api"],
      });

      expect(res.success).toBe(true);
      expect(res.granted).toEqual(["audience_reach", "attendance_verification_api"]);
    });

    it("grant rejects invalid purpose enum", async () => {
      const caller = createCaller(callerMockUser);
      await expect(
        caller.grant({
          purposes: ["invalid_purpose" as any],
        })
      ).rejects.toThrow();
    });

    it("grant rejects empty purposes array", async () => {
      const caller = createCaller(callerMockUser);
      await expect(
        caller.grant({
          purposes: [],
        })
      ).rejects.toThrow();
    });

    it("revoke validates purpose enum and revokes successfully", async () => {
      const caller = createCaller(callerMockUser);
      const res = await caller.revoke({
        purpose: "audience_reach",
      });

      expect(res.success).toBe(true);
      expect(res.revoked).toBe("audience_reach");
    });

    it("revoke rejects invalid purpose enum", async () => {
      const caller = createCaller(callerMockUser);
      await expect(
        caller.revoke({
          purpose: "hack_everything" as any,
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
      const unauthCaller = createCaller(null);
      await expect(unauthCaller.getMine()).rejects.toThrowError(
        new TRPCError({ code: "UNAUTHORIZED", message: "No auth header found" })
      );
    });

    it("rejects banned user with FORBIDDEN", async () => {
      const bannedCaller = createCaller({ ...callerMockUser, role: "ban" });
      await expect(bannedCaller.getMine()).rejects.toThrowError(
        new TRPCError({ code: "FORBIDDEN", message: "user is banned" })
      );
    });
  });
});
