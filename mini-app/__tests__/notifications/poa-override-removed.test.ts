import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleNotificationReply } from "@/sockets/handlers/notificationReply";
import { eventRegistrants } from "@/db/schema";
import type { Server } from "socket.io";

interface CapturedUpdate {
  table: unknown;
  set: Record<string, unknown>;
  where?: unknown;
}

interface MockNotification {
  id: number;
  userId: number;
  type: string;
  itemId: number;
  item_type: string;
  status: string;
  readAt?: Date | null;
  actionTimeout?: number;
}

interface MockPoaTrigger {
  id: number;
  eventId: number;
}

interface MockEvent {
  event_id: number;
  event_uuid: string;
  secret_phrase: string;
  start_date: number;
  end_date: number;
}

interface MockEventField {
  id: number;
  event_id: number;
  title: string;
}

const {
  mockDbUpdates,
  mockNotifications,
  mockPoaTriggers,
  mockEvents,
  mockFields,
  mockRedisCache,
  mockUpsertUserEventFields,
} = vi.hoisted(() => ({
  mockDbUpdates: [] as CapturedUpdate[],
  mockNotifications: {} as Record<number, MockNotification>,
  mockPoaTriggers: {} as Record<number, MockPoaTrigger>,
  mockEvents: {} as Record<number, MockEvent>,
  mockFields: {} as Record<number, MockEventField>,
  mockRedisCache: {} as Record<string, unknown>,
  mockUpsertUserEventFields: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/db/db", () => {
  const dbMock = {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((setVals: Record<string, unknown>) => {
        const captured: CapturedUpdate = { table, set: setVals };
        mockDbUpdates.push(captured);
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
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue([]),
        onConflictDoUpdate: vi.fn(() => ({
          execute: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  };

  return {
    db: dbMock,
    dbLower: dbMock,
  };
});

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

vi.mock("@/db/modules/events.db", () => ({
  getEventById: vi.fn().mockImplementation((id: number) => {
    return Promise.resolve(mockEvents[id] || null);
  }),
}));

vi.mock("@/db/modules/eventFields.db", () => ({
  default: {
    getEventFieldByTitleAndEventId: vi.fn().mockImplementation((title: string, eventId: number) => {
      return Promise.resolve(mockFields[eventId] || null);
    }),
  },
}));

vi.mock("@/db/modules/userEventFields.db", () => ({
  default: {
    upsertUserEventFields: mockUpsertUserEventFields,
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
  },
}));

vi.mock("@/db/modules/visitors.db", () => ({
  default: {
    addVisitor: vi.fn().mockResolvedValue({ id: 42, user_id: 12345, event_uuid: "test-uuid" }),
  },
}));

vi.mock("@/db/modules/rewards.db", () => ({
  default: {
    checkExistingRewardWithType: vi.fn().mockResolvedValue(null),
    insertRewardRow: vi.fn().mockResolvedValue({ id: 88 }),
  },
}));

vi.mock("@/lib/bcrypt", () => ({
  default: {
    comparePassword: vi.fn().mockImplementation(async (plain: string, hashed: string) => {
      return hashed === `$2b$10$hashed_${plain}`;
    }),
    hashPassword: vi.fn().mockImplementation(async (plain: string) => `$2b$10$hashed_${plain}`),
  },
}));

vi.mock("@/lib/redisTools", () => ({
  getCache: vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(mockRedisCache[key] ?? null);
  }),
  setCache: vi.fn().mockImplementation((key: string, val: unknown) => {
    mockRedisCache[key] = val;
    return Promise.resolve(true);
  }),
  deleteCache: vi.fn().mockImplementation((key: string) => {
    delete mockRedisCache[key];
    return Promise.resolve(true);
  }),
  cacheKeys: {
    notification: "notification:",
  },
}));

vi.mock("@/server/utils/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Issue #1044: Universal Daily POA Password Override Removal (F-30)", () => {
  const fakeIo = {
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  } as unknown as Server;

  const attendeeUserId = 54321;
  const notificationId = 77;
  const eventId = 888;
  const eventUuid = "44444444-4444-4444-4444-444444444444";
  const organizerSecret = "organizer-exclusive-poa-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdates.length = 0;
    for (const key of Object.keys(mockRedisCache)) delete mockRedisCache[key];
    for (const key of Object.keys(mockNotifications)) delete mockNotifications[Number(key)];
    for (const key of Object.keys(mockPoaTriggers)) delete mockPoaTriggers[Number(key)];
    for (const key of Object.keys(mockEvents)) delete mockEvents[Number(key)];
    for (const key of Object.keys(mockFields)) delete mockFields[Number(key)];

    const nowSec = Math.floor(Date.now() / 1000);
    mockNotifications[notificationId] = {
      id: notificationId,
      userId: attendeeUserId,
      type: "POA_PASSWORD",
      itemId: 99,
      item_type: "POA_TRIGGER",
      status: "PENDING",
      readAt: new Date(),
      actionTimeout: 300,
    };
    mockPoaTriggers[99] = {
      id: 99,
      eventId,
    };
    mockEvents[eventId] = {
      event_id: eventId,
      event_uuid: eventUuid,
      secret_phrase: `$2b$10$hashed_${organizerSecret}`,
      start_date: nowSec - 3600,
      end_date: nowSec + 3600,
    };
    mockFields[eventId] = {
      id: 101,
      event_id: eventId,
      title: "secret_phrase_onton_input",
    };
  });

  it("strictly rejects the legacy hardcoded daily password override pattern", async () => {
    // Generate the exact daily pattern that used to be accepted: ${day}ShahKey@${month}
    const today = new Date();
    const dayOfMonth = today.getDate();
    const monthNameShort = today.toLocaleString("en-US", { month: "short" });
    const legacyOverridePassword = `${dayOfMonth}ShahKey@${monthNameShort}`;

    let callbackResult: { status: string; message: string } | null = null;
    const callback = (res: { status: string; message: string }) => {
      callbackResult = res;
    };

    await handleNotificationReply(
      fakeIo,
      {
        notificationId,
        answer: legacyOverridePassword,
        type: "POA_PASSWORD",
      },
      callback,
      "intruder_user",
      attendeeUserId
    );

    // The handler must reject the legacy override password
    expect(callbackResult).toEqual({
      status: "password_error",
      message: "Password incorrect, try again",
    });

    // Redis tries must be incremented
    const redisKey = `notification:${notificationId}:tries`;
    expect(mockRedisCache[redisKey]).toBe(1);

    // No attendee promotion to checkedin must occur
    expect(mockDbUpdates).toHaveLength(0);
    expect(mockUpsertUserEventFields).not.toHaveBeenCalled();
  });

  it("accepts only the organizer-set POA secret answer", async () => {
    let callbackResult: { status: string; message: string } | null = null;
    const callback = (res: { status: string; message: string }) => {
      callbackResult = res;
    };

    await handleNotificationReply(
      fakeIo,
      {
        notificationId,
        answer: organizerSecret,
        type: "POA_PASSWORD",
      },
      callback,
      "valid_attendee",
      attendeeUserId
    );

    // The handler must successfully accept the real organizer-set secret
    expect(callbackResult).toEqual({
      status: "success",
      message: `Notification ${notificationId} reply '${organizerSecret}' processed successfully`,
    });

    // Event attendee must be updated to checkedin
    const updateCall = mockDbUpdates.find((u) => u.table === eventRegistrants);
    expect(updateCall).toBeDefined();
    expect(updateCall?.set.status).toBe("checkedin");
    expect(updateCall?.set.updatedBy).toBe(String(attendeeUserId));
    expect(mockUpsertUserEventFields).toHaveBeenCalledWith(
      attendeeUserId,
      eventId,
      101,
      `$2b$10$hashed_${organizerSecret}`
    );
  });
});
