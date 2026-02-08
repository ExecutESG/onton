import { db } from "@/db/db";
import { moderationLog } from "@/db/schema/moderation_log";
import { ModerationLogActionType } from "@/db/schema/moderation_log";
import { and, eq, sql } from "drizzle-orm";

export const insertModerationLog = async (params: {
  moderatorUserId: number;
  eventUuid: string;
  eventOwnerId: number;
  action: ModerationLogActionType;
  customText?: string;
}) => {
  const { moderatorUserId, eventUuid, eventOwnerId, action, customText } = params;
  await db.insert(moderationLog).values({
    moderatorUserId,
    eventUuid,
    eventOwnerId,
    action,
    customText: customText ?? null,
  });
};

/**
 * Count how many total NOTICE actions the given user (event owner) has.
 * Returns a plain number (0, 1, 2, ...).
 */
export const getNoticeCountForOwner = async (ownerId: number): Promise<number> => {
  // Example Drizzle query to do SELECT COUNT(*) FROM moderation_log WHERE ...
  const result = await db
    .select({
      count: sql<number>`count
          (*)
          ::int`,
    })
    .from(moderationLog)
    .where(and(eq(moderationLog.eventOwnerId, ownerId), eq(moderationLog.action, "NOTICE")));

  // result is an array of rows; get the `count` field from the first row
  return result[0]?.count ?? 0;
};

const moderationLogDB = {
  insertModerationLog,
  getNoticeCountForOwner,
};
export default moderationLogDB;
