import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

import { eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

// Import the schema & types
import { taskSBT, TaskSBT, TaskSBTInsert } from "@/db/schema/taskSbt";

/* ------------------------------------------------------------------
   Redis Cache Key Builders
------------------------------------------------------------------ */
function buildCacheKeyById(id: number) {
  return `task_sbt:id:${id}`;
}

/* ------------------------------------------------------------------
   "Get" Methods with Redis Caching
------------------------------------------------------------------ */
export async function getTaskSbtById(id: number): Promise<TaskSBT | undefined> {
  try {
    const cacheKey = buildCacheKeyById(id);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TaskSBT;
    }

    const [row] = await db.select().from(taskSBT).where(eq(taskSBT.id, id)).execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }

    return undefined;
  } catch (error) {
    logger.error("taskSbtDB: Error getting task_sbt by ID:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Insert Methods
------------------------------------------------------------------ */
export async function addTaskSbt(data: TaskSBTInsert): Promise<TaskSBT> {
  try {
    const [inserted] = await db.insert(taskSBT).values(data).returning().execute();

    // Re-cache
    await revalidateCache(inserted);

    return inserted;
  } catch (error) {
    logger.error("taskSbtDB: Error inserting task_sbt:", error);
    throw error;
  }
}

/** Insert row inside a transaction */
export async function addTaskSbtTx(tx: PgTransaction<PostgresJsQueryResultHKT>, data: TaskSBTInsert): Promise<TaskSBT> {
  const [inserted] = await tx.insert(taskSBT).values(data).returning().execute();

  await revalidateCache(inserted);
  return inserted;
}

/* ------------------------------------------------------------------
   Update Methods
------------------------------------------------------------------ */
export async function updateTaskSbtById(id: number, data: Partial<TaskSBTInsert>): Promise<TaskSBT | undefined> {
  try {
    const result = await db.update(taskSBT).set(data).where(eq(taskSBT.id, id)).returning().execute();

    const updated = result[0];
    if (updated) {
      await revalidateCache(updated);
      return updated;
    }

    return undefined;
  } catch (error) {
    logger.error("taskSbtDB: Error updating task_sbt:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Cache Revalidation
------------------------------------------------------------------ */
async function revalidateCache(row: TaskSBT) {
  const cacheKey = buildCacheKeyById(row.id);
  await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
}

/* ------------------------------------------------------------------
   Export as an object for convenience
------------------------------------------------------------------ */
export const taskSbtDB = {
  getTaskSbtById,
  addTaskSbt,
  addTaskSbtTx,
  updateTaskSbtById,
};
