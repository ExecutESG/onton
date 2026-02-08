import { db } from "@/db/db";
import {
  CallBackTaskAPINameType,
  CallBackTaskFunctionType,
  CallBackTaskItemType,
  callbackTasks,
} from "@/db/schema/callbackTasks";
import { and, eq, isNull } from "drizzle-orm";
import type { CallbackTasksRow } from "@/db/schema/callbackTasks";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger"; // your existing redis tools

/**
 * Fetch a single callbackTasks row by ID, with Redis caching.
 */
export const fetchCallbackTaskById = async (id: number): Promise<CallbackTasksRow | undefined> => {
  const cacheKey = `${redisTools.cacheKeys.callbackTask}${id}`;

  try {
    // 1) Check Redis cache first
    const cachedData = await redisTools.getCache(cacheKey);
    if (cachedData) {
      // parse the cached data as CallbackTasksRow
      const task: CallbackTasksRow = cachedData;
      return task;
    }

    // 2) If not cached, fetch from DB
    const [task] = await db.select().from(callbackTasks).where(eq(callbackTasks.id, id)).limit(1);

    // 3) If found in DB, store in Redis
    if (task) {
      await redisTools.setCache(cacheKey, task, redisTools.cacheLvl.medium);
    }

    return task;
  } catch (err) {
    // If there's a Redis error or any other issue, log & fallback to DB result only
    logger.error(`Error fetching callback task by ID=${id}`, err);

    // Attempt direct DB fetch, ignoring cache
    const [task] = await db.select().from(callbackTasks).where(eq(callbackTasks.id, id)).limit(1);

    return task;
  }
};

/**
 * A helper to find the callback_tasks row for a given config, or throw an error if not found.
 */
const findCallbackTaskStrict = async (params: {
  apiName: CallBackTaskAPINameType;
  taskFunction: CallBackTaskFunctionType;
  itemType?: CallBackTaskItemType | null;
  itemId?: number | null;
}): Promise<CallbackTasksRow> => {
  const { apiName, taskFunction, itemType, itemId } = params;

  // Build a query that tries to match itemType/itemId if provided
  // If itemType is not provided, we can either ignore that condition or check if it's null
  // likewise for itemId
  const conditions = [eq(callbackTasks.api_name, apiName), eq(callbackTasks.task_function, taskFunction)];

  if (itemType != null) {
    conditions.push(eq(callbackTasks.item_type, itemType));
  } else {
    // optional: push something like isNull(callbackTasks.item_type)
    // or skip if you want item_type ignored
    conditions.push(isNull(callbackTasks.item_type));
  }

  if (itemId != null) {
    conditions.push(eq(callbackTasks.item_id, itemId));
  } else {
    conditions.push(isNull(callbackTasks.item_id));
  }

  const [task] = await db
    .select()
    .from(callbackTasks)
    .where(and(...conditions))
    .limit(1);

  if (!task) {
    throw new Error(
      `No callback_tasks found for apiName=${apiName}, taskFunction=${taskFunction}, itemType=${itemType}, itemId=${itemId}`
    );
  }
  return task;
};

const callbackTasksDB = {
  fetchCallbackTaskById,
  findCallbackTaskStrict,
};

export default callbackTasksDB;
