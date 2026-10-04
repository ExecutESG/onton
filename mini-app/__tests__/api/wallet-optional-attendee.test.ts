import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TRPCContext } from "@/server/context";
import { eventRegistrants, visitors, users } from "@/db/schema";
import { TRPCError } from "@trpc/server";

type UserSelect = typeof users.$inferSelect;

interface CapturedInsert {
  table: unknown;
  values: Record<string, unknown>;
  onConflict?: unknown;
}

interface CapturedUpdate {
  table: unknown;
  set: Record<string, unknown>;
  where?: unknown;
}

interface MockEventData {
  event_id?: number;
  event_uuid?: string;
  has_registration?: boolean;
  participationType?: string;
  sbt_collection_address?: string | null;
  has_payment?: boolean;
  owner?: number;
  secret_phrase?: string;
  start_date?: number;
  end_date?: number;
}

interface MockFieldData {
  id: number;
  event_id: number;
  title: string;
}

interface MockRegistrantData {
  registrant_uuid?: string;
  event_uuid?: string;
  user_id?: number;
  status?: string;
}

interface MockNotificationData {
  id: number;
  userId: number;
  type: string;
  itemId: number;
  item_type: string;
  status: string;
  readAt?: Date | null;
  actionTimeout?: number;
}

interface MockPoaTriggerData {
  id: number;
  eventId: number;
}

const {
  mockTxCaptured,
  mockDbCaptured,
  mockEventsData,
  mockFieldsData,
  mockRegistrantsData,
  mockNotifications,
  mockPoaTriggers,
  mockUpsertUserEventFields,
  mockInsertRewardRow,
  mockDeleteCache,
  mockSendTelegramMessage,
} = vi.hoisted(() => ({
  mockTxCaptured: {
    insertCalls: [] as CapturedInsert[],
    updateCalls: [] as CapturedUpdate[],
  },
  mockDbCaptured: {
    insertCalls: [] as CapturedInsert[],
    updateCalls: [] as CapturedUpdate[],
    transactionCalls: 0,
  },
  mockEventsData: {} as Record<string | number, MockEventData>,
  mockFieldsData: {} as Record<string | number, MockFieldData>,
  mockRegistrantsData: [] as MockRegistrantData[],
  mockNotifications: {} as Record<number, MockNotificationData>,
  mockPoaTriggers: {} as Record<number, MockPoaTriggerData>,
  mockUpsertUserEventFields: vi.fn().mockResolvedValue({ id: 1 }),
  mockInsertRewardRow: vi.fn().mockResolvedValue({ id: 99 }),
  mockDeleteCache: vi.fn().mockResolvedValue(true),
  mockSendTelegramMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/db/db", () => {
  const txMock = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue([]),
          })),
          execute: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        const captured: CapturedInsert = { table, values: vals };
        mockTxCaptured.insertCalls.push(captured);
        return {
          execute: vi.fn().mockResolvedValue([]),
          onConflictDoUpdate: vi.fn((conf: unknown) => {
            captured.onConflict = conf;
            return {
              execute: vi.fn().mockResolvedValue([]),
            };
          }),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((setVals: Record<string, unknown>) => {
        const captured: CapturedUpdate = { table, set: setVals };
        mockTxCaptured.updateCalls.push(captured);
        return {
          where: vi.fn((whereCond: unknown) => {
            captured.where = whereCond;
            return {
              execute: vi.fn().mockResolvedValue([]),
            };
          }),
        };
      }),
    })),
  };

  const dbMock = {
    transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      mockDbCaptured.transactionCalls++;
      return await cb(txMock);
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          execute: vi.fn().mockImplementation(() => {
            return Promise.resolve([...mockRegistrantsData]);
          }),
        })),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((setVals: Record<string, unknown>) => {
        const captured: CapturedUpdate = { table, set: setVals };
        mockDbCaptured.updateCalls.push(captured);
        return {
          where: vi.fn((whereCond: unknown) => {
            captured.where = whereCond;
            return {
              execute: vi.fn().mockResolvedValue([]),
            };
          }),
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        const captured: CapturedInsert = { table, values: vals };
        mockDbCaptured.insertCalls.push(captured);
        return {
          execute: vi.fn().mockResolvedValue([]),
          onConflictDoUpdate: vi.fn((conf: unknown) => {
            captured.onConflict = conf;
            return {
              execute: vi.fn().mockResolvedValue([]),
            };
          }),
        };
      }),
    })),
    query: {
      events: {
        findFirst: vi.fn().mockImplementation(() => {
          return Object.values(mockEventsData)[0] || null;
        }),
      },
    },
  };

  return {
    db: dbMock,
    dbLower: dbMock,
  };
});

vi.mock("@/db/modules/events.db", () => {
  const getEventById = vi.fn().mockImplementation((id: number) => {
    return Promise.resolve(mockEventsData[id] || null);
  });
  const selectEventByUuid = vi.fn().mockImplementation((uuid: string) => {
    return Promise.resolve(mockEventsData[uuid] || null);
  });
  const updateEventSbtCollection = vi.fn().mockResolvedValue(undefined);
  return {
    default: {
      getEventById,
      selectEventByUuid,
      updateEventSbtCollection,
    },
    getEventById,
    selectEventByUuid,
    updateEventSbtCollection,
  };
});

vi.mock("@/db/modules/eventFields.db", () => {
  const getEventFields = vi.fn().mockImplementation((id: number) => {
    return Promise.resolve(mockFieldsData[id] ? [mockFieldsData[id]] : []);
  });
  const getEventFieldById = vi.fn().mockImplementation((id: number) => {
    return Promise.resolve(mockFieldsData[id] || null);
  });
  const getEventFieldByTitleAndEventId = vi.fn().mockImplementation((title: string, eventId: number) => {
    return Promise.resolve(mockFieldsData[eventId] || null);
  });
  return {
    default: {
      getEventFields,
      getEventFieldById,
      getEventFieldByTitleAndEventId,
    },
    getEventFields,
    getEventFieldById,
    getEventFieldByTitleAndEventId,
  };
});

vi.mock("@/db/modules/userEventFields.db", () => ({
  default: {
    upsertUserEventFields: mockUpsertUserEventFields,
    getUserEventFields: vi.fn().mockResolvedValue([]),
  },
  upsertUserEventFields: mockUpsertUserEventFields,
  getUserEventFields: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/bcrypt", () => ({
  default: {
    hashPassword: vi.fn().mockImplementation(async (pw: string) => `$2b$10$hashed_${pw}`),
    comparePassword: vi.fn().mockImplementation(async (plain: string, hashed: string) => {
      return hashed === `$2b$10$hashed_${plain}` || hashed === plain;
    }),
  },
}));

vi.mock("@/lib/checkRateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
}));

vi.mock("@/db/modules/rewards.db", () => ({
  default: {
    insertRewardRow: mockInsertRewardRow,
    checkExistingRewardWithType: vi.fn().mockResolvedValue(null),
  },
  insertRewardRow: mockInsertRewardRow,
  checkExistingRewardWithType: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db/modules/visitors.db", () => ({
  default: {
    addVisitor: vi.fn().mockResolvedValue({ id: 88, user_id: 10001, event_uuid: "test-uuid" }),
  },
  addVisitor: vi.fn().mockResolvedValue({ id: 88, user_id: 10001, event_uuid: "test-uuid" }),
}));

vi.mock("@/lib/redisTools", () => ({
  redisTools: {
    acquireLock: vi.fn().mockResolvedValue(true),
    releaseLock: vi.fn().mockResolvedValue(true),
    deleteCache: mockDeleteCache,
    getCache: vi.fn().mockResolvedValue(null),
    setCache: vi.fn().mockResolvedValue(true),
  },
  deleteCache: mockDeleteCache,
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
  cacheKeys: {
    notification: "notification:",
  },
}));

vi.mock("@/db/modules/users.db", () => ({
  getUserCacheKey: (id: number) => `user_cache_${id}`,
}));

vi.mock("@/lib/tgBot", () => ({
  sendTelegramMessage: mockSendTelegramMessage,
  sendEventPhoto: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/totp/passToken", () => ({
  generatePassToken: vi.fn().mockReturnValue("ONTON:v1:mocktoken"),
  verifyPassToken: vi.fn().mockImplementation((token: string) => {
    if (token === "invalid-token") {
      return { valid: false, message: "Invalid pass token" };
    }
    return { valid: true, uuid: "mock-registrant-uuid" };
  }),
}));

vi.mock("@/db/modules/notifications.db", () => ({
  notificationsDB: {
    getNotificationById: vi.fn().mockImplementation((id: number) => {
      return Promise.resolve(mockNotifications[id] || null);
    }),
    updateNotificationStatusAndReply: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/db/modules/eventPoaTriggers.db", () => ({
  eventPoaTriggersDB: {
    getEventPoaTriggerById: vi.fn().mockImplementation((id: number) => {
      return Promise.resolve(mockPoaTriggers[id] || null);
    }),
  },
}));

vi.mock("@/db/modules/eventPoaResults.db", () => ({
  eventPoaResultsDB: {
    insertPoaResult: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock("@/db/modules/eventRegistrants.db", () => ({
  eventRegistrantsDB: {
    getByEventUuidAndUserId: vi.fn().mockImplementation((eventUuid: string, userId: number) => {
      return Promise.resolve({
        id: 1,
        event_uuid: eventUuid,
        user_id: userId,
        status: "approved",
      });
    }),
    getRegistrantRequest: vi.fn(),
  },
}));

vi.mock("@/db/modules/userRoles.db", () => ({
  userRolesDB: {
    checkAccess: vi.fn().mockResolvedValue([]),
    checkHasAnyAccessToItemType: vi.fn().mockResolvedValue([]),
  },
}));

import { trpcApiInstance } from "@/server/trpc";
import { userEventFieldsRouter } from "@/server/routers/userEventFields";
import { registrantRouter } from "@/server/routers/registrant";
import { handleNotificationReply } from "@/sockets/handlers/notificationReply";
import { db } from "@/db/db";
import type { Server } from "socket.io";

import type { ExtendedUser } from "@/types/extendedUserTypes";

function createTestContext(userOverrides: Partial<ExtendedUser> = {}): TRPCContext {
  const defaultUser: ExtendedUser = {
    user_id: 10001,
    uuid: "user-uuid-1",
    email: "user@test.com",
    auth_provider: "telegram",
    telegram_id: 10001,
    username: "testuser",
    first_name: "Test",
    last_name: "User",
    wallet_address: null,
    language_code: "en",
    role: "user",
    created_at: new Date(),
    updatedAt: new Date(),
    updatedBy: "system",
    is_premium: false,
    allows_write_to_pm: true,
    photo_url: null,
    participated_event_count: 0,
    hosted_event_count: 0,
    has_blocked_the_bot: false,
    org_channel_name: null,
    org_support_telegram_user_name: null,
    org_x_link: null,
    org_bio: null,
    org_image: null,
    user_point: 0,
    affiliatorUserId: null,
    CustomAccessRoles: [],
    ...userOverrides,
  };

  return {
    req: new Request("https://localhost/api/trpc"),
    user: defaultUser,
  };
}

describe("Issue #1032: Wallet-Optional Attendee Flows (Real Router & Handlers)", () => {
  const userEventFieldsCaller = trpcApiInstance.createCallerFactory(userEventFieldsRouter);
  const registrantCaller = trpcApiInstance.createCallerFactory(registrantRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    mockTxCaptured.insertCalls.length = 0;
    mockTxCaptured.updateCalls.length = 0;
    mockDbCaptured.insertCalls.length = 0;
    mockDbCaptured.updateCalls.length = 0;
    mockDbCaptured.transactionCalls = 0;
    mockRegistrantsData.length = 0;
    for (const key of Object.keys(mockEventsData)) delete mockEventsData[key];
    for (const key of Object.keys(mockFieldsData)) delete mockFieldsData[key];
    for (const key of Object.keys(mockNotifications)) delete mockNotifications[Number(key)];
    for (const key of Object.keys(mockPoaTriggers)) delete mockPoaTriggers[Number(key)];
  });

  describe("userEventFieldsRouter.upsertUserEventField", () => {
    it("rejects with BAD_REQUEST and executes no transaction when event has registration", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockFieldsData[201] = {
        id: 201,
        event_id: 101,
        title: "secret_phrase_onton_input",
      };
      mockEventsData[101] = {
        event_id: 101,
        event_uuid: "evt-uuid-registration",
        has_registration: true,
        secret_phrase: "$2b$10$hashed_secretpass",
        start_date: nowSec - 3600,
        end_date: nowSec + 3600,
      };

      const caller = userEventFieldsCaller(createTestContext());

      let caughtError: TRPCError | null = null;
      try {
        await caller.upsertUserEventField({
          event_id: 101,
          field_id: 201,
          data: "secretpass",
        });
      } catch (err) {
        caughtError = err as TRPCError;
      }

      expect(caughtError).toBeInstanceOf(TRPCError);
      expect(caughtError?.code).toBe("BAD_REQUEST");
      expect(caughtError?.message).toBe(
        "it is not possible to use the password for the events with registration"
      );
      expect(mockDbCaptured.transactionCalls).toBe(0);
      expect(mockTxCaptured.insertCalls).toHaveLength(0);
      expect(mockUpsertUserEventFields).not.toHaveBeenCalled();
    });

    it("rejects with error and performs no database writes when password is incorrect", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockFieldsData[202] = {
        id: 202,
        event_id: 102,
        title: "secret_phrase_onton_input",
      };
      mockEventsData[102] = {
        event_id: 102,
        event_uuid: "evt-uuid-wrongpass",
        has_registration: false,
        secret_phrase: "$2b$10$hashed_correctpass",
        start_date: nowSec - 3600,
        end_date: nowSec + 3600,
      };

      const caller = userEventFieldsCaller(createTestContext());

      await expect(
        caller.upsertUserEventField({
          event_id: 102,
          field_id: 202,
          data: "wrongpass",
        })
      ).rejects.toThrow(/Password incorrect/);

      expect(mockDbCaptured.transactionCalls).toBe(0);
      expect(mockTxCaptured.insertCalls).toHaveLength(0);
      expect(mockUpsertUserEventFields).not.toHaveBeenCalled();
      expect(mockInsertRewardRow).not.toHaveBeenCalled();
    });

    it("executes transaction writing visitor and checkedin eventRegistrants row with onConflictDoUpdate, invalidates cache, and does NOT call insertRewardRow", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockFieldsData[203] = {
        id: 203,
        event_id: 103,
        title: "secret_phrase_onton_input",
      };
      mockEventsData[103] = {
        event_id: 103,
        event_uuid: "evt-uuid-valid",
        has_registration: false,
        secret_phrase: "$2b$10$hashed_mysecretphrase",
        start_date: nowSec - 3600,
        end_date: nowSec + 3600,
      };

      const caller = userEventFieldsCaller(createTestContext());

      const result = await caller.upsertUserEventField({
        event_id: 103,
        field_id: 203,
        data: "mysecretphrase",
      });

      expect(result).toEqual({ success: true });
      expect(mockDbCaptured.transactionCalls).toBe(1);

      // Verify visitors write
      const visitorInsert = mockTxCaptured.insertCalls.find((call) => call.table === visitors);
      expect(visitorInsert).toBeDefined();
      expect(visitorInsert?.values).toEqual({
        user_id: 10001,
        event_uuid: "evt-uuid-valid",
        updatedBy: "10001",
      });

      // Verify eventRegistrants write with status 'checkedin' and onConflictDoUpdate
      const regInsert = mockTxCaptured.insertCalls.find((call) => call.table === eventRegistrants);
      expect(regInsert).toBeDefined();
      expect(regInsert?.values.status).toBe("checkedin");
      expect(regInsert?.values.event_uuid).toBe("evt-uuid-valid");
      expect(regInsert?.values.user_id).toBe(10001);
      expect(regInsert?.onConflict).toBeDefined();

      // Verify user cache invalidation and upsertUserEventFields called
      expect(mockDeleteCache).toHaveBeenCalledWith("user_cache_10001");
      expect(mockUpsertUserEventFields).toHaveBeenCalledWith(
        10001,
        103,
        203,
        "$2b$10$hashed_mysecretphrase"
      );

      // Verify rewardDB.insertRewardRow is strictly NOT called
      expect(mockInsertRewardRow).not.toHaveBeenCalled();
    });

    it("does not call upsertUserEventFields when transaction fails", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockFieldsData[204] = {
        id: 204,
        event_id: 104,
        title: "secret_phrase_onton_input",
      };
      mockEventsData[104] = {
        event_id: 104,
        event_uuid: "evt-uuid-txfail",
        has_registration: false,
        secret_phrase: "$2b$10$hashed_pass",
        start_date: nowSec - 3600,
        end_date: nowSec + 3600,
      };

      // Force db.transaction to fail
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error("DB transaction rolled back"));

      const caller = userEventFieldsCaller(createTestContext());

      await expect(
        caller.upsertUserEventField({
          event_id: 104,
          field_id: 204,
          data: "pass",
        })
      ).rejects.toThrow("DB transaction rolled back");

      expect(mockUpsertUserEventFields).not.toHaveBeenCalled();
    });
  });

  describe("registrantRouter.checkinRegistrantRequest", () => {
    const eventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

    it("sends telegram notification with exact text, Put it on-chain label, and ?start=ticket_<uuid> deep link", async () => {
      const eventRecord = {
        event_id: 501,
        event_uuid: eventUuid,
        has_registration: true,
        participationType: "in_person",
        sbt_collection_address: "0:sbt_collection_badge_address",
        has_payment: false,
        owner: 99999,
      };
      mockEventsData[eventUuid] = eventRecord;
      mockRegistrantsData.push({
        registrant_uuid: "mock-registrant-uuid",
        event_uuid: eventUuid,
        user_id: 20002,
        status: "approved",
      });

      const caller = registrantCaller(
        createTestContext({
          user_id: 99999,
          role: "admin",
        })
      );

      const result = await caller.checkinRegistrantRequest({
        event_uuid: eventUuid,
        registrant_uuid: "ONTON:v1:mocktoken",
      });

      expect(result.code).toBe(200);
      expect(mockSendTelegramMessage).toHaveBeenCalledWith({
        chat_id: 20002,
        message: "🎉 You're checked in! Your attendance is recorded in ONTON.",
        link: `https://t.me/notnonstagebot?start=ticket_${eventUuid}`,
        linkText: "Put it on-chain",
      });
    });

    it("omits link and linkText when event has no sbt_collection_address", async () => {
      const eventRecord = {
        event_id: 502,
        event_uuid: eventUuid,
        has_registration: true,
        participationType: "in_person",
        sbt_collection_address: null,
        has_payment: false,
        owner: 99999,
      };
      mockEventsData[eventUuid] = eventRecord;
      mockRegistrantsData.push({
        registrant_uuid: "mock-registrant-uuid",
        event_uuid: eventUuid,
        user_id: 20002,
        status: "approved",
      });

      const caller = registrantCaller(
        createTestContext({
          user_id: 99999,
          role: "admin",
        })
      );

      const result = await caller.checkinRegistrantRequest({
        event_uuid: eventUuid,
        registrant_uuid: "ONTON:v1:mocktoken",
      });

      expect(result.code).toBe(200);
      expect(mockSendTelegramMessage).toHaveBeenCalledWith({
        chat_id: 20002,
        message: "🎉 You're checked in! Your attendance is recorded in ONTON.",
        link: undefined,
        linkText: undefined,
      });
    });
  });

  describe("handleNotificationReply", () => {
    it("guards update by status='approved' and does not insert into eventRegistrants", async () => {
      const notificationId = 15;
      const attendeeUserId = 30003;
      const poaEventUuid = "poa-event-uuid-777";
      const nowSec = Math.floor(Date.now() / 1000);

      mockNotifications[notificationId] = {
        id: notificationId,
        userId: attendeeUserId,
        type: "POA_PASSWORD",
        itemId: 80,
        item_type: "POA_TRIGGER",
        status: "PENDING",
        readAt: new Date(),
        actionTimeout: 300,
      };
      mockPoaTriggers[80] = {
        id: 80,
        eventId: 707,
      };
      mockEventsData[707] = {
        event_id: 707,
        event_uuid: poaEventUuid,
        secret_phrase: "$2b$10$hashed_organizer_poa_code",
        start_date: nowSec - 3600,
        end_date: nowSec + 3600,
      };
      mockFieldsData[707] = {
        id: 901,
        event_id: 707,
        title: "secret_phrase_onton_input",
      };

      const fakeIo = {
        to: vi.fn().mockReturnValue({
          emit: vi.fn(),
        }),
      } as unknown as Server;

      let callbackStatus = "";
      const callback = (res: { status: string; message: string }) => {
        callbackStatus = res.status;
      };

      await handleNotificationReply(
        fakeIo,
        { notificationId, answer: "organizer_poa_code", type: "POA_PASSWORD" },
        callback,
        "test_attendee",
        attendeeUserId
      );

      expect(callbackStatus).toBe("success");

      // Verify UPDATE was called on eventRegistrants with status='checkedin'
      const regUpdate = mockDbCaptured.updateCalls.find((c) => c.table === eventRegistrants);
      expect(regUpdate).toBeDefined();
      expect(regUpdate?.set.status).toBe("checkedin");
      expect(regUpdate?.set.updatedBy).toBe(String(attendeeUserId));

      // Verify NO INSERT was executed on eventRegistrants
      const regInsert = mockDbCaptured.insertCalls.find((c) => c.table === eventRegistrants);
      expect(regInsert).toBeUndefined();
    });
  });
});
