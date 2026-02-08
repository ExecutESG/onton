// tasksDB.ts
import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

import { and, eq, sql, isNull, lte, gte, or } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

import { tasks, Tasks, TasksInsert, TaskTypeType } from "@/db/schema/tasks";

/* ------------------------------------------------------------------
   Redis Cache Keys
------------------------------------------------------------------ */
function buildCacheKeyById(id: number) {
  return `tasks:id:${id}`;
}

function buildCacheKeyByGroupId(groupId: number) {
  return `tasks:group_id:${groupId}`;
}

function buildCacheKeyByType(taskType: string, onlyAvailableNow: boolean) {
  return `tasks:type:${taskType}:avail:${onlyAvailableNow ? 1 : 0}`;
}

/** For "all tasks that are available now" we can define a single key */
function buildCacheKeyAvailableNow() {
  return `tasks:available_now`;
}

/* ------------------------------------------------------------------
   Get Methods
------------------------------------------------------------------ */

/**
 * 1. getTaskById
 */
export async function getTaskById(id: number): Promise<Tasks | undefined> {
  try {
    const cacheKey = buildCacheKeyById(id);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Tasks;
    }

    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }
    return undefined;
  } catch (error) {
    logger.error("tasksDB: Error getting tasks by ID:", error);
    throw error;
  }
}

/**
 * 2. getTasksByGroupId
 */
export async function getTasksByGroupId(groupId: number): Promise<Tasks[]> {
  try {
    const cacheKey = buildCacheKeyByGroupId(groupId);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Tasks[];
    }

    const rows = await db.select().from(tasks).where(eq(tasks.groupId, groupId)).execute();

    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.long);
    return rows;
  } catch (error) {
    logger.error("tasksDB: Error getting tasks by groupId:", error);
    throw error;
  }
}
/**
 * getTasksByType
 * - Filters tasks by their `taskType`.
 * - If `onlyAvailableNow` is `true`, uses raw SQL with `CURRENT_DATE` & `CURRENT_TIME`
 *   to ensure tasks are within open/close date/time range (or null).
 * - No JavaScript date/time is used here—DB is the source of truth.
 */
export async function getTasksByType(taskType: TaskTypeType, onlyAvailableNow = false): Promise<Tasks[]> {
  try {
    const cacheKey = buildCacheKeyByType(taskType, onlyAvailableNow);

    // Try Redis cache first
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Tasks[];
    }

    // If we only want tasks "available now," build a raw SQL snippet
    let finalWhere;
    if (onlyAvailableNow) {
      // This snippet checks:
      //  1) open_date is null OR <= CURRENT_DATE
      //  2) close_date is null OR >= CURRENT_DATE
      //  3) open_time is null OR <= CURRENT_TIME
      //  4) close_time is null OR >= CURRENT_TIME
      const availabilitySnippet = sql`
        (
          ${tasks.openDate} IS NULL OR ${tasks.openDate} <= CURRENT_DATE
        )
        AND (
          ${tasks.closeDate} IS NULL OR ${tasks.closeDate} >= CURRENT_DATE
        )
        AND (
          ${tasks.openTime} IS NULL OR ${tasks.openTime} <= CURRENT_TIME
        )
        AND (
          ${tasks.closeTime} IS NULL OR ${tasks.closeTime} >= CURRENT_TIME
        )
      `;

      // Combine with taskType check using Drizzle's `and(...)`
      finalWhere = and(eq(tasks.taskType, taskType), availabilitySnippet);
    } else {
      // If not filtering by availability, just match taskType
      finalWhere = eq(tasks.taskType, taskType);
    }

    // Execute query with the final WHERE clause
    const rows = await db.select().from(tasks).where(finalWhere).execute();

    // Cache the result (short TTL recommended, since "available now" changes over time)
    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.short);

    return rows;
  } catch (error) {
    logger.error("tasksDB: Error getting tasks by type:", error);
    throw error;
  }
}

/**
 * 4. getTasksAvailableNow
 * Returns *all* tasks that are valid at the current date/time
 * (regardless of taskType).
 */
export async function getTasksAvailableNow(): Promise<Tasks[]> {
  try {
    const cacheKey = buildCacheKeyAvailableNow();
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Tasks[];
    }

    // This is the same date/time logic but without restricting taskType.
    const whereClause = and(
      or(isNull(tasks.openDate), lte(tasks.openDate, sql`CURRENT_DATE`)),
      or(isNull(tasks.closeDate), gte(tasks.closeDate, sql`CURRENT_DATE`)),
      or(isNull(tasks.openTime), lte(tasks.openTime, sql`CURRENT_TIME`)),
      or(isNull(tasks.closeTime), gte(tasks.closeTime, sql`CURRENT_TIME`))
    );

    const rows = await db.select().from(tasks).where(whereClause).execute();

    // For time-based availability, consider a short TTL or no caching
    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.short);

    return rows;
  } catch (error) {
    logger.error("tasksDB: Error getting tasks available now:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Insert Methods
------------------------------------------------------------------ */
export async function addTask(data: TasksInsert): Promise<Tasks> {
  try {
    const [inserted] = await db.insert(tasks).values(data).returning().execute();
    await revalidateCache(inserted);
    return inserted;
  } catch (error) {
    logger.error("tasksDB: Error inserting tasks:", error);
    throw error;
  }
}

export async function addTaskTx(tx: PgTransaction<PostgresJsQueryResultHKT>, data: TasksInsert): Promise<Tasks> {
  const [inserted] = await tx.insert(tasks).values(data).returning().execute();
  await revalidateCache(inserted);
  return inserted;
}

/* ------------------------------------------------------------------
   Update Methods
------------------------------------------------------------------ */
export async function updateTaskById(id: number, data: Partial<TasksInsert>): Promise<Tasks | undefined> {
  try {
    const result = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning().execute();

    const updated = result[0];
    if (updated) {
      await revalidateCache(updated);
      return updated;
    }
    return undefined;
  } catch (error) {
    logger.error("tasksDB: Error updating tasks:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Cache Revalidation
------------------------------------------------------------------ */
async function revalidateCache(row: Tasks) {
  // 1) Re-cache the row by ID
  const idKey = buildCacheKeyById(row.id);
  await redisTools.setCache(idKey, JSON.stringify(row), redisTools.cacheLvl.long);

  // 2) If it belongs to a group, re-cache that group’s tasks
  if (row.groupId !== null && row.groupId !== undefined) {
    const groupKey = buildCacheKeyByGroupId(row.groupId);
    const groupTasks = await db.select().from(tasks).where(eq(tasks.groupId, row.groupId)).execute();
    await redisTools.setCache(groupKey, JSON.stringify(groupTasks), redisTools.cacheLvl.long);
  }

  // 3) The row’s taskType + "availableNow" caches might be stale. Optionally:
  //    - Invalidate or update them. For now, skipping or using short TTL is typical.
}

export const tasksDB = {
  getTaskById,
  getTasksByGroupId,
  getTasksByType,
  getTasksAvailableNow,
  addTask,
  addTaskTx,
  updateTaskById,
};
