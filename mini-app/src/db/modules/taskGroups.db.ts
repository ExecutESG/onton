import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

import { eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

import { taskGroups, TaskGroups, TaskGroupsInsert } from "@/db/schema/taskGroups";

/* ------------------------------------------------------------------
   Redis Cache Keys
------------------------------------------------------------------ */
function buildCacheKeyById(id: number) {
  return `task_groups:id:${id}`;
}

/* ------------------------------------------------------------------
   Get Methods
------------------------------------------------------------------ */
export async function getTaskGroupById(id: number): Promise<TaskGroups | undefined> {
  try {
    const cacheKey = buildCacheKeyById(id);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TaskGroups;
    }

    const [row] = await db.select().from(taskGroups).where(eq(taskGroups.id, id)).execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }

    return undefined;
  } catch (error) {
    logger.error("taskGroupsDB: Error getting task_groups by ID:", error);
    throw error;
  }
}

/* Optionally: get all groups */
export async function getAllTaskGroups(): Promise<TaskGroups[]> {
  try {
    // Could add a global cache key, e.g., "task_groups:all"
    const cacheKey = `task_groups:all`;
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TaskGroups[];
    }

    const rows = await db.select().from(taskGroups).execute();
    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.long);
    return rows;
  } catch (error) {
    logger.error("taskGroupsDB: Error getting all task_groups:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Insert Methods
------------------------------------------------------------------ */
export async function addTaskGroup(data: TaskGroupsInsert): Promise<TaskGroups> {
  try {
    const [inserted] = await db.insert(taskGroups).values(data).returning().execute();
    await revalidateCache(inserted);
    return inserted;
  } catch (error) {
    logger.error("taskGroupsDB: Error inserting task_groups:", error);
    throw error;
  }
}

export async function addTaskGroupTx(
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  data: TaskGroupsInsert
): Promise<TaskGroups> {
  const [inserted] = await tx.insert(taskGroups).values(data).returning().execute();
  await revalidateCache(inserted);
  return inserted;
}

/* ------------------------------------------------------------------
   Update Methods
------------------------------------------------------------------ */
export async function updateTaskGroupById(id: number, data: Partial<TaskGroupsInsert>): Promise<TaskGroups | undefined> {
  try {
    const result = await db.update(taskGroups).set(data).where(eq(taskGroups.id, id)).returning().execute();

    const updated = result[0];
    if (updated) {
      await revalidateCache(updated);
      return updated;
    }
    return undefined;
  } catch (error) {
    logger.error("taskGroupsDB: Error updating task_groups:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Revalidation
------------------------------------------------------------------ */
async function revalidateCache(row: TaskGroups) {
  // 1) Cache the row by ID
  const idKey = buildCacheKeyById(row.id);
  await redisTools.setCache(idKey, JSON.stringify(row), redisTools.cacheLvl.long);

  // 2) Also re-cache "all" if you're using getAllTaskGroups
  const allKey = `task_groups:all`;
  await redisTools.deleteCache(allKey); // Force re-fetch next time
}

/* ------------------------------------------------------------------
   Export
------------------------------------------------------------------ */
export const taskGroupsDB = {
  getTaskGroupById,
  getAllTaskGroups,
  addTaskGroup,
  addTaskGroupTx,
  updateTaskGroupById,
};
