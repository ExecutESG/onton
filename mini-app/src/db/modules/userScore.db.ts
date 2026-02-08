import { db } from "@/db/db";
import {
  activityTypesArray,
  userScoreItemArray,
  UserScoreItemType,
  usersScore,
  UsersScoreActivityType,
} from "@/db/schema/usersScore";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { EventWithScoreAndReward } from "@/types/event.types";
import { and, desc, eq, inArray, lte, not, or, sql } from "drizzle-orm";
import { events, rewards, users, visitors } from "../schema";

export type TotalScoreByActivityTypeAndUserId = {
  total: number;
  count: number;
};

export type JoinOntonAffiliateRow = {
  id: bigint;
  point: string | null; // non-null
  itemId: number | null;
  itemType: UserScoreItemType | null;
  createdAt: Date | null;
  userId: number;
  userName: string | null; // these four may be null
  userFirstName: string | null;
  userLastName: string | null;
  userPhotoUrl: string | null;
};
export type JoinOntonAffiliateScore = {
  id: number;
  point: number; // converted to number for the client
  itemId: number;
  createdAt: string | null; // Date is converted to string on the client
  userId: number;
  userName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userPhotoUrl: string | null;
};

export type ScoreItem = EventWithScoreAndReward & JoinOntonAffiliateScore;

// Cache key helpers
const getTotalScoreByUserIdCacheKey = (userId: number) => `${redisTools.cacheKeys.usersScore}total:${userId}`;
const getTotalScoreByActivityTypeAndUserIdCacheKey = (
  userId: number,
  activityType: UsersScoreActivityType,
  itemType: UserScoreItemType
) => `${redisTools.cacheKeys.usersScore}${activityType}:${userId}:${itemType}`;

const getTotalScoreByActivitiesCacheKey = (
  userId: number,
  activityTypes: UsersScoreActivityType[], // array
  itemType: UserScoreItemType
) => `${redisTools.cacheKeys.usersScore}` + `${activityTypes.sort().join("|")}:${userId}:${itemType}`;

const invalidateUserScoreCache = async (userId: number) => {
  await redisTools.deleteCache(getTotalScoreByUserIdCacheKey(userId));

  for (const type of activityTypesArray) {
    for (const itemType of userScoreItemArray) {
      await redisTools.deleteCache(getTotalScoreByActivityTypeAndUserIdCacheKey(userId, type, itemType));
    }
  }
};
/**
 * Create a new usersScore record.
 * After insertion, invalidate all cached scores for the user.
 */
export const createUserScore = async (scoreData: {
  userId: number;
  activityType: UsersScoreActivityType;
  point: number;
  active: boolean;
  itemId: number;
  itemType: UserScoreItemType;
}) => {
  try {
    const result = await db
      .insert(usersScore)
      .values({
        userId: scoreData.userId,
        activityType: scoreData.activityType,
        point: scoreData.point.toString(),
        active: scoreData.active,
        itemId: scoreData.itemId,
        itemType: scoreData.itemType,
        createdAt: new Date(),
      })
      .returning();
    logger.log("UserScore created:", result);

    // Invalidate cache
    await invalidateUserScoreCache(scoreData.userId);

    return result;
  } catch (error) {
    logger.error("Error creating UserScore:", error);
    throw error;
  }
};

/**
 * Change the status (active flag) of a usersScore record by its ID.
 */
export const changeUserScoreStatus = async (id: bigint, newStatus: boolean, userId: number) => {
  try {
    await db
      .update(usersScore)
      .set({ active: newStatus })
      .where(and(eq(usersScore.id, id), eq(usersScore.userId, userId)))
      .execute();
    // Invalidate cache
    await invalidateUserScoreCache(userId);
    logger.log(`UserScore ${id} status changed to ${newStatus}`);
  } catch (error) {
    logger.error("Error changing UserScore status:", error);
    throw error;
  }
};

/**
 * Update the point (score) of a usersScore record by its ID.
 */
export const updateUserScore = async (id: bigint, newPoint: number, userId: number) => {
  try {
    await db
      .update(usersScore)
      .set({ point: newPoint.toString() })
      .where(and(eq(usersScore.id, id), eq(usersScore.userId, userId)))
      .execute();
    // Invalidate cache
    await invalidateUserScoreCache(userId);
    logger.log(`UserScore ${id} point updated to ${newPoint}`);
  } catch (error) {
    logger.error("Error updating UserScore:", error);
    throw error;
  }
};

/**
 * Get the total score for a user by summing the points of all records
 * with the given userId. Uses Redis caching.
 */
export const getTotalScoreByUserId = async (userId: number): Promise<number> => {
  try {
    const cacheKey = getTotalScoreByUserIdCacheKey(userId);
    const cachedResult = await redisTools.getCache(cacheKey);
    if (cachedResult !== null && cachedResult !== undefined) {
      return cachedResult as number;
    }

    const result = (
      await db
        .select({
          total: sql<number>`COALESCE
              (SUM(${usersScore.point}), 0)`,
        })
        .from(usersScore)
        .where(eq(usersScore.userId, userId))
        .execute()
    ).pop();

    const total = result?.total || 0;
    await redisTools.setCache(cacheKey, total, redisTools.cacheLvl.extraLong);
    return total;
  } catch (error) {
    logger.error("Error getting total score by user id:", error);
    throw error;
  }
};

/**
 * Get the total score for a user filtered by a specific activity type.
 * Uses Redis caching.
 */
export const getTotalScoreByActivityTypeAndUserId = async (
  userId: number,
  activityType: UsersScoreActivityType,
  itemType: UserScoreItemType
): Promise<TotalScoreByActivityTypeAndUserId> => {
  try {
    const cacheKey = getTotalScoreByActivityTypeAndUserIdCacheKey(userId, activityType, itemType);
    const cachedResult = await redisTools.getCache(cacheKey);
    if (cachedResult !== null && cachedResult !== undefined) {
      return cachedResult as TotalScoreByActivityTypeAndUserId;
    }

    const result = (
      await db
        .select({
          total: sql<number>`COALESCE
              (SUM(${usersScore.point}), 0)`,
          count: sql<number>`COUNT
              (${usersScore.point})`,
        })
        .from(usersScore)
        .where(
          and(eq(usersScore.userId, userId), eq(usersScore.activityType, activityType), eq(usersScore.itemType, itemType))
        )
        .execute()
    ).pop();

    const data: TotalScoreByActivityTypeAndUserId = result || { total: 0, count: 0 };
    await redisTools.setCache(cacheKey, data, redisTools.cacheLvl.extraLong);
    return data;
  } catch (error) {
    logger.error("Error getting total score by activity type and user id:", error);
    throw error;
  }
};

export const upsertOrganizerScore = async (scoreData: {
  userId: number;
  activityType: UsersScoreActivityType;
  point: number; // how much to add or insert
  active: boolean;
  itemId: number;
  itemType: UserScoreItemType;
}) => {
  try {
    // 1) Check if a record already exists for (userId, activityType, active, itemId, itemType)
    const [existing] = await db
      .select({
        id: usersScore.id,
        point: usersScore.point,
      })
      .from(usersScore)
      .where(
        and(
          eq(usersScore.userId, scoreData.userId),
          eq(usersScore.activityType, scoreData.activityType),
          eq(usersScore.itemId, scoreData.itemId),
          eq(usersScore.itemType, scoreData.itemType),
          eq(usersScore.active, scoreData.active)
        )
      )
      .execute();

    // 2) If no record found, INSERT
    if (!existing) {
      const insertResult = await db
        .insert(usersScore)
        .values({
          userId: scoreData.userId,
          activityType: scoreData.activityType,
          point: scoreData.point.toString(), // Drizzle expects string for numeric columns
          active: scoreData.active,
          itemId: scoreData.itemId,
          itemType: scoreData.itemType,
          createdAt: new Date(),
        })
        .returning(); // Return the newly inserted row(s)

      // Invalidate cache for user
      await invalidateUserScoreCache(scoreData.userId);

      logger.log("UserScore inserted:", insertResult);
      return insertResult;
    } else {
      // 3) If record **does** exist, increment the existing point
      const currentPoint = parseFloat(existing.point || "0"); // Convert to number
      const newTotal = currentPoint + scoreData.point; // add the new points

      await db.update(usersScore).set({ point: newTotal.toString() }).where(eq(usersScore.id, existing.id)).execute();

      // Invalidate cache for user
      await invalidateUserScoreCache(scoreData.userId);

      logger.log(`UserScore ${existing.id} incremented by ${scoreData.point}, new total: ${newTotal}`);
      return { updatedId: existing.id, newTotal };
    }
  } catch (error) {
    logger.error("Error upserting organizer score:", error);
    throw error;
  }
};

export async function getEventsWithClaimAndScoreDBPaginated(
  userId: number,
  activityType: UsersScoreActivityType,
  isPaid: boolean,
  isOnline: boolean,
  pointsCouldBeClaimed: number,
  currentTimeSec: number,
  limit: number,
  offset: number
): Promise<EventWithScoreAndReward[]> {
  // The same query as before, but add .limit(...) and .offset(...)
  const rows = await db
    .select({
      eventId: events.event_id,
      eventTitle: events.title,
      eventUuid: events.event_uuid,
      eventStartDate: events.start_date,
      eventEndDate: events.end_date,
      imageUrl: events.image_url,
      visitorId: visitors.id,
      rewardId: rewards.id,
      rewardStatus: rewards.status,
      rewardData: rewards.data,
      tonSocietyStatus: rewards.tonSocietyStatus,
      userScoreId: usersScore.id,
      userScorePoints: usersScore.point,
    })
    .from(visitors)
    .innerJoin(
      events,
      and(
        eq(events.event_uuid, visitors.event_uuid),
        or(eq(events.has_payment, isPaid), eq(events.ticketToCheckIn, isPaid)),
        eq(events.participationType, isOnline ? "online" : "in_person"),
        lte(events.start_date, currentTimeSec),
        eq(events.hidden, false)
      )
    )
    .innerJoin(
      rewards,
      and(
        eq(rewards.visitor_id, visitors.id),
        eq(rewards.type, "ton_society_sbt"),
        not(eq(rewards.status, "pending_creation")),
        not(eq(rewards.status, "failed"))
      )
    )
    .leftJoin(
      usersScore,
      and(
        eq(usersScore.itemId, events.event_id),
        eq(usersScore.itemType, "event"),
        eq(usersScore.activityType, activityType),
        eq(usersScore.userId, visitors.user_id)
      )
    )
    .where(eq(visitors.user_id, userId))
    .orderBy(desc(events.end_date))
    .limit(limit)
    .offset(offset);

  logger.log(`======================`, activityType, rows);
  // Convert row data
  return rows.map<EventWithScoreAndReward>((row) => ({
    eventId: Number(row.eventId),
    eventTitle: row.eventTitle,
    eventUuid: row.eventUuid,
    eventStartDate: Number(row.eventStartDate),
    eventEndDate: Number(row.eventEndDate),
    imageUrl: row.imageUrl || null,
    rewardLink:
      row.rewardData && "reward_link" in row.rewardData ? (row.rewardData as { reward_link: string }).reward_link : null,
    visitorId: Number(row.visitorId),
    tonSocietyStatus: row.tonSocietyStatus,
    rewardId: row.rewardId ? String(row.rewardId) : null,
    rewardStatus: row.rewardStatus || null,
    userScoreId: row.userScoreId ? Number(row.userScoreId) : null,
    userClaimedPoints: row.userScorePoints ? Number(row.userScorePoints) : 0,
    pointsCouldBeClaimed,
  }));
}
//**
// getUserScoresByActivityTypeAndUserId
// Get all user scores for a specific activity type and user ID
// */
export async function getUserScoresForJoinOntonAffiliatePaginated(
  userId: number,
  limit: number,
  offset: number
): Promise<JoinOntonAffiliateRow[]> {
  const raw = await db
    .select({
      id: usersScore.id,
      point: usersScore.point, // numeric → string
      itemId: usersScore.itemId,
      itemType: usersScore.itemType,
      createdAt: usersScore.createdAt,
      userId: users.user_id,
      userName: users.username,
      userFirstName: users.first_name,
      userLastName: users.last_name,
      userPhotoUrl: users.photo_url,
    })
    .from(usersScore)
    .innerJoin(users, and(eq(usersScore.itemId, users.user_id), eq(usersScore.activityType, "join_onton_affiliate")))
    .where(eq(usersScore.userId, userId))
    .limit(limit)
    .offset(offset)
    .execute();

  /* Cast fields that are guaranteed non-null */
  const rows: JoinOntonAffiliateRow[] = raw.map((r) => ({
    id: r.id as bigint,
    point: r.point as string,
    itemId: r.itemId,
    itemType: r.itemType as UserScoreItemType,
    createdAt: r.createdAt as Date,
    userId: r.userId,
    userName: r.userName,
    userFirstName: r.userFirstName,
    userLastName: r.userLastName,
    userPhotoUrl: r.userPhotoUrl,
  }));

  return rows;
}

export const getTotalScoreByActivityTypesAndUserId = async (
  userId: number,
  activityTypes: UsersScoreActivityType[], // ← array
  itemType: UserScoreItemType
): Promise<TotalScoreByActivityTypeAndUserId> => {
  try {
    /* -------- cache -------- */
    const cacheKey = getTotalScoreByActivitiesCacheKey(userId, activityTypes, itemType);
    const cached = await redisTools.getCache(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached as TotalScoreByActivityTypeAndUserId;
    }

    /* -------- query -------- */
    const result = (
      await db
        .select({
          total: sql<number>`COALESCE(SUM(${usersScore.point}), 0)`,
          count: sql<number>`COUNT(${usersScore.point})`,
        })
        .from(usersScore)
        .where(
          and(
            eq(usersScore.userId, userId),
            inArray(usersScore.activityType, activityTypes), // drizzle `inArray`
            eq(usersScore.itemType, itemType)
          )
        )
        .execute()
    ).pop();

    /* -------- store & return -------- */
    const data: TotalScoreByActivityTypeAndUserId = result || { total: 0, count: 0 };
    await redisTools.setCache(cacheKey, data, redisTools.cacheLvl.extraLong);
    return data;
  } catch (error) {
    logger.error("Error getting total score by activity types and user id:", error);
    throw error;
  }
};
export const userScoreDb = {
  createUserScore,
  changeUserScoreStatus,
  updateUserScore,
  getTotalScoreByUserId,
  getTotalScoreByActivityTypeAndUserId,
  upsertOrganizerScore,
  getEventsWithClaimAndScoreDBPaginated,
  getUserScoresForJoinOntonAffiliatePaginated,
  getTotalScoreByActivityTypesAndUserId,
};
