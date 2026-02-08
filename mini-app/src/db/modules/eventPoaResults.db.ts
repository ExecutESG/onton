import { db } from "@/db/db";
import { eventPoaResults, EventPoaResultStatus, eventPoaResultStatus } from "@/db/schema";
import { redisTools } from "@/lib/redisTools";
import { eq, and } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
// Cache key generator for POA results
const getPoaResultCacheKey = (userId: number, eventId: number) =>
  `${redisTools.cacheKeys.eventPoaResult}${userId}:${eventId}`;

// Get POA results by user ID and event ID
export const getPoaResultsByUserIdAndEventId = async (userId: number, eventId: number) => {
  try {
    const cacheKey = getPoaResultCacheKey(userId, eventId);
    const cachedResult = await redisTools.getCache(cacheKey);

    if (cachedResult) {
      return cachedResult; // Return cached data if available
    }

    const results = await db
      .select()
      .from(eventPoaResults)
      .where(and(eq(eventPoaResults.userId, userId), eq(eventPoaResults.eventId, eventId)))
      .execute();

    await redisTools.setCache(cacheKey, results, redisTools.cacheLvl.short); // Cache the result
    logger.log(`POA Results for User ${userId} and Event ${eventId} retrieved:`, results);
    return results;
  } catch (error) {
    logger.error("Error getting POA results by user ID and event ID:", error);
    throw error;
  }
};

// Get POA results by user ID, event ID, and status
export const getPoaResultsByUserIdEventIdAndStatus = async (
  userId: number,
  eventId: number,
  status: EventPoaResultStatus
) => {
  try {
    const results = await db
      .select()
      .from(eventPoaResults)
      .where(
        and(
          eq(eventPoaResults.userId, userId),
          eq(eventPoaResults.eventId, eventId),
          eq(eventPoaResults.status, status)
        )
      )
      .execute();

    logger.log(`POA Results for User ${userId}, Event ${eventId}, and Status "${status}" retrieved:`, results);
    return results;
  } catch (error) {
    logger.error("Error getting POA results by user ID, event ID, and status:", error);
    throw error;
  }
};

// Insert a new POA result
export const insertPoaResult = async (params: {
  userId: number;
  poaId: number;
  eventId: number;
  poaAnswer: string;
  status: EventPoaResultStatus; // Use the TypeScript enum type
  repliedAt?: Date; // Optional
  notificationId?: number; // Optional
}) => {
  try {
    const {
      userId,
      poaId,
      eventId,
      poaAnswer,
      status,
      repliedAt = null, // Default to null if not provided
      notificationId = null, // Default to null if not provided
    } = params;

    // Optional: Validate that 'status' is a valid enum value
    if (!eventPoaResultStatus.enumValues.includes(status)) {
      throw new Error(`Invalid status value: ${status}`);
    }

    // Insert the new POA result
    const insertedResult = await db
      .insert(eventPoaResults)
      .values({
        userId,
        poaId,
        eventId,
        poaAnswer,
        status,
        repliedAt,
        notificationId,
      })
      .returning(); // Returns the inserted record

    // Invalidate relevant caches
    const cacheKeysToInvalidate = [
      getPoaResultCacheKey(userId, eventId),
      `${redisTools.cacheKeys.eventPoaResultsByEvent}${eventId}`,
    ];

    await Promise.all(
      cacheKeysToInvalidate.map((key) => redisTools.deleteCache(key))
    );

    return insertedResult;
  } catch (error) {
    logger.error("Error inserting POA result:", error);
    throw error;
  }
};
// Get POA results by event ID
export const getPoaResultsByEventId = async (eventId: number) => {
  try {
    const cacheKey = `${redisTools.cacheKeys.eventPoaResultsByEvent}${eventId}`;
    const cachedResult = await redisTools.getCache(cacheKey);

    if (cachedResult) {
      return cachedResult; // Return cached data if available
    }

    const results = await db
      .select()
      .from(eventPoaResults)
      .where(eq(eventPoaResults.eventId, eventId))
      .execute();

    await redisTools.setCache(cacheKey, results, redisTools.cacheLvl.short); // Cache the result
    logger.log(`POA Results for Event ${eventId} retrieved:`, results);
    return results;
  } catch (error) {
    logger.error("Error getting POA results by event ID:", error);
    throw error;
  }
};

// Export all functions as a single object
export const eventPoaResultsDB = {
  getPoaResultsByUserIdAndEventId,
  getPoaResultsByUserIdEventIdAndStatus,
  getPoaResultsByEventId,
  insertPoaResult,
};
