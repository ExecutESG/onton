import { db } from "@/db/db";
import { eventPoaTriggers, EventTriggerStatus, EventTriggerType } from "@/db/schema";
import { redisTools } from "@/lib/redisTools";
import { eq, and, lte, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

export type EventPoaTrigger = {
  id: number;
  eventId: number;
  poaOrder: number ;
  startTime: number;
  countOfSent: number;
  countOfSuccess: number;
  poaType: "simple" | "multiple_choice" | "question" | "password";
  status: "active" | "deactive" | "completed" | "sending";
  createdAt: Date | null;
  updatedAt: Date | null;
  creator_user_id: number;
};
// Cache key prefix for event POA triggers
const getEventPoaCacheKey = (poaId: number) => `${redisTools.cacheKeys.eventPoaTrigger}${poaId}`;

// Add a new event POA trigger
export const addEventPoaTrigger = async (poaData: {
  eventId: number;
  poaOrder: number;
  startTime: number;
  countOfSent: number;
  countOfSuccess: number;
  poaType: EventTriggerType; // "simple", "multiple_choice", or "question"
  status: EventTriggerStatus; // "active", "deactive", "completed", "sending"
  createdAt?: Date;
  updatedAt?: Date;
  creator_user_id: number;
}) => {
  try {
    const result = await db
      .insert(eventPoaTriggers)
      .values({
        eventId: poaData.eventId,
        poaOrder: poaData.poaOrder,
        startTime: poaData.startTime,
        countOfSent: poaData.countOfSent,
        countOfSuccess: poaData.countOfSuccess,
        poaType: poaData.poaType,
        status: poaData.status,
        createdAt: poaData.createdAt || new Date(),
        updatedAt: poaData.updatedAt || new Date(),
        creator_user_id: poaData.creator_user_id,
      })
      .onConflictDoNothing()
      .returning()
      .execute();
    logger.log("POA Trigger added:", result);
    return result;
  } catch (error) {
    logger.error("Error adding POA Trigger:", error);
    throw error;
  }
};

// Update the status of a POA trigger by ID
export const updateEventPoaStatus = async (poaId: number, newStatus: EventTriggerStatus) => {
  try {
    await db
      .update(eventPoaTriggers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(eventPoaTriggers.id, poaId))
      .execute();

    // Clear cache for this POA trigger
    await redisTools.deleteCache(getEventPoaCacheKey(poaId));
    logger.log(`POA Trigger ${poaId} status updated to ${newStatus}`);
  } catch (error) {
    logger.error("Error updating POA Trigger status:", error);
    throw error;
  }
};

// Increment the count of sent by ID
export const incrementCountOfSent = async (poaId: number, incrementBy = 1) => {
  try {
    // Execute raw SQL using sql tagged template
    await db.execute(
      sql`UPDATE ${eventPoaTriggers}
          SET count_of_sent = count_of_sent + ${incrementBy},
              updated_at    = ${new Date()}
          WHERE id = ${poaId}`,
    );

    await redisTools.deleteCache(getEventPoaCacheKey(poaId)); // Clear cache
    logger.log(`Incremented countOfSent for POA Trigger ${poaId}`);
  } catch (error) {
    logger.error("Error incrementing countOfSent:", error);
    throw error;
  }
};

// Increment the count of success by ID
export const incrementCountOfSuccess = async (poaId: number, incrementBy = 1) => {
  try {
    await db.execute(
      sql`UPDATE ${eventPoaTriggers}
          SET count_of_success = count_of_success + ${incrementBy},
              updated_at       = ${new Date()}
          WHERE id = ${poaId}`,
    );

    await redisTools.deleteCache(getEventPoaCacheKey(poaId)); // Clear cache
    logger.log(`Incremented countOfSuccess for POA Trigger ${poaId}`);
  } catch (error) {
    logger.error("Error incrementing countOfSuccess:", error);
    throw error;
  }
};

// Get a list of active POAs by time
export const getActivePoaForEventByTime = async (eventId: number, startTime: number) => {
  try {

    return await db
      .select()
      .from(eventPoaTriggers)
      .where(
        and(
          eq(eventPoaTriggers.eventId, eventId),
          eq(eventPoaTriggers.status, "active" as const),
          lte(eventPoaTriggers.startTime, startTime),
        ),
      )
      .execute();

  } catch (error) {
    logger.error("Error getting active POAs by time:", error);
    throw error;
  }
};

// Get POAs by event ID
export const getPoaByEventId = async (eventId: number) => {
  try {
    const cacheKey = `${redisTools.cacheKeys.eventPoaByEvent}${eventId}`;
    // const cachedResult = await redisTools.getCache(cacheKey);

    // if (cachedResult) {
    //   return cachedResult; // Return cached data if available
    // }

    const poaTriggers = await db
      .select()
      .from(eventPoaTriggers)
      .where(eq(eventPoaTriggers.eventId, eventId))
      .execute();

    await redisTools.setCache(cacheKey, poaTriggers, redisTools.cacheLvl.short); // Cache the result
    return poaTriggers;
  } catch (error) {
    logger.error("Error getting POAs by event ID:", error);
    throw error;
  }
};

export const generatePoaForAddEvent = async (
  trx: typeof db, // Accept the transaction context
  params: {
    eventId: number;
    eventStartTime: number;
    eventEndTime: number;
    poaCount: number;
    poaType: EventTriggerType;
    bufferMinutes?: number;
  },
) => {
  const { eventId, eventStartTime, eventEndTime, poaCount, poaType } = params;

  const buffer = (params.bufferMinutes ?? 10) * 60; // Buffer of minutes in seconds

  if (eventStartTime >= eventEndTime) {
    throw new Error("Event start time must be less than end time.");
  }

  if (poaCount <= 0) {
    throw new Error("POA count must be greater than zero.");
  }

  const adjustedStartTime = eventStartTime + buffer;
  const adjustedEndTime = eventEndTime - buffer;

  if (adjustedStartTime >= adjustedEndTime) {
    throw new Error(
      "Adjusted event times are invalid. Ensure the event duration is longer than the buffer.",
    );
  }

  let interval: number;
  if (poaCount === 1) {
    // If only one POA, place it in the middle of the adjusted time
    interval = 0;
  } else {
    // Correct Interval Calculation:
    // Divide the total adjusted duration by (poaCount - 1) to evenly distribute POAs
    interval = Math.floor((adjustedEndTime - adjustedStartTime) / (poaCount - 1));
  }

  const poaStartTimes = Array.from({ length: poaCount }, (_, i) => {
    if (poaCount === 1) {
      // Place single POA in the middle
      return Math.floor((adjustedStartTime + adjustedEndTime) / 2);
    }
    return adjustedStartTime + i * interval;
  });

  const existingPoa = await trx
    .select({ poaOrder: eventPoaTriggers.poaOrder })
    .from(eventPoaTriggers)
    .where(
      and(
        eq(eventPoaTriggers.eventId, eventId),
        eq(eventPoaTriggers.status, "active" as const),
      ),
    )
    .execute();

  const maxExistingOrder = existingPoa.reduce<number>(
    (max, poa) => (poa.poaOrder !== null && poa.poaOrder > max ? poa.poaOrder : max),
    0,
  );

  try {
    for (let i = 0; i < poaStartTimes.length; i++) {
      const poaOrder = maxExistingOrder + i + 1;
      const poaData = {
        eventId,
        poaOrder,
        startTime: poaStartTimes[i],
        countOfSent: 0,
        countOfSuccess: 0,
        poaType,
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await trx.insert(eventPoaTriggers).values(poaData).execute();
      logger.log(`POA Trigger added for event ${eventId}:`, poaData);
    }
    logger.log(`Generated ${poaStartTimes.length} POA triggers for event ${eventId}.`);
  } catch (error) {
    logger.error("Error generating POA triggers:", error);
    throw error;
  }
};

export const getEventPoaTriggerById = async (poaId: number) => {
  try {
    const cacheKey = getEventPoaCacheKey(poaId);
    const cachedResult = await redisTools.getCache(cacheKey);

    if (cachedResult) {
      return cachedResult; // Return cached data if available
    }

    const poaTrigger = await db
      .select()
      .from(eventPoaTriggers)
      .where(eq(eventPoaTriggers.id, poaId))
      .execute();
    const result = poaTrigger[0];
    await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.medium); // Cache the result
    return result;
  } catch (error) {
    logger.error("Error getting POA Trigger by ID:", error);
    throw error;
  }
};
// Export all functions in a single object
export const eventPoaTriggersDB = {
  addEventPoaTrigger,
  updateEventPoaStatus,
  incrementCountOfSent,
  incrementCountOfSuccess,
  getActivePoaForEventByTime,
  getPoaByEventId,
  generatePoaForAddEvent,
  getEventPoaTriggerById,

};