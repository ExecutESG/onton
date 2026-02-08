import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";

import { and, eq, inArray } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

import { taskUsers, TaskUsers, TaskUsersInsert } from "@/db/schema/taskUsers";

/* ------------------------------------------------------------------
   Cache Keys
------------------------------------------------------------------ */
function buildCacheKeyById(id: number) {
  return `users_task:id:${id}`;
}

/** e.g., "users_task:userId:42:taskId:10" */
function buildCacheKeyByUserAndTask(userId: number, taskId: number) {
  return `users_task:user:${userId}:task:${taskId}`;
}

/* ------------------------------------------------------------------
   Get Methods
------------------------------------------------------------------ */
export async function getUserTaskById(id: number): Promise<TaskUsers | undefined> {
  try {
    const cacheKey = buildCacheKeyById(id);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TaskUsers;
    }

    const [row] = await db.select().from(taskUsers).where(eq(taskUsers.id, id)).execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }

    return undefined;
  } catch (error) {
    logger.error("taskUsersDB: Error getting users_task by ID:", error);
    throw error;
  }
}

/** Typically, you might query by (user_id, task_id) to see a specific user’s status for a specific task */
export async function getUserTaskByUserAndTask(userId: number, tId: number): Promise<TaskUsers | undefined> {
  try {
    const cacheKey = buildCacheKeyByUserAndTask(userId, tId);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TaskUsers;
    }

    const [row] = await db
      .select()
      .from(taskUsers)
      .where(and(eq(taskUsers.userId, userId), eq(taskUsers.taskId, tId)))
      .execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }
    return undefined;
  } catch (error) {
    logger.error("taskUsersDB: Error getting users_task by (user, task):", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Insert Methods
------------------------------------------------------------------ */
export async function addUserTask(data: TaskUsersInsert): Promise<TaskUsers> {
  try {
    const [inserted] = await db.insert(taskUsers).values(data).returning().execute();
    await revalidateCache(inserted);
    return inserted;
  } catch (error) {
    logger.error("taskUsersDB: Error inserting users_task:", error);
    throw error;
  }
}

export async function addUserTaskTx(tx: PgTransaction<PostgresJsQueryResultHKT>, data: TaskUsersInsert): Promise<TaskUsers> {
  const [inserted] = await tx.insert(taskUsers).values(data).returning().execute();
  await revalidateCache(inserted);
  return inserted;
}

/* ------------------------------------------------------------------
   Update Methods
------------------------------------------------------------------ */
export async function updateUserTaskById(id: number, data: Partial<TaskUsersInsert>): Promise<TaskUsers | undefined> {
  try {
    const result = await db.update(taskUsers).set(data).where(eq(taskUsers.id, id)).returning().execute();

    const updated = result[0];
    if (updated) {
      await revalidateCache(updated);
      return updated;
    }
    return undefined;
  } catch (error) {
    logger.error("taskUsersDB: Error updating users_task by ID:", error);
    throw error;
  }
}

/** Alternatively, update by (userId, taskId) if you prefer. */
export async function updateUserTaskByUserAndTask(
  userId: number,
  tId: number,
  data: Partial<TaskUsersInsert>
): Promise<TaskUsers | undefined> {
  try {
    const result = await db
      .update(taskUsers)
      .set(data)
      .where(and(eq(taskUsers.userId, userId), eq(taskUsers.taskId, tId)))
      .returning()
      .execute();

    const updated = result[0];
    if (updated) {
      await revalidateCache(updated);
      return updated;
    }
    return undefined;
  } catch (error) {
    logger.error("taskUsersDB: Error updating users_task by (user,task):", error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Revalidation
------------------------------------------------------------------ */
async function revalidateCache(row: TaskUsers) {
  // 1) By ID
  const idKey = buildCacheKeyById(row.id);
  await redisTools.setCache(idKey, JSON.stringify(row), redisTools.cacheLvl.long);

  // 2) By (userId, taskId)
  const userTaskKey = buildCacheKeyByUserAndTask(row.userId, row.taskId);
  await redisTools.setCache(userTaskKey, JSON.stringify(row), redisTools.cacheLvl.long);
}

export async function getUserTasksByUserAndTaskIds(userId: number, taskIds: number[]): Promise<TaskUsers[]> {
  if (taskIds.length === 0) return [];

  try {
    // Simple no-cache approach, or you can do caching similarly
    const rows = await db
      .select()
      .from(taskUsers)
      .where(and(eq(taskUsers.userId, userId), inArray(taskUsers.taskId, taskIds)))
      .execute();

    return rows;
  } catch (error) {
    // handle error
    throw error;
  }
}

/* ------------------------------------------------------------------
   Export
------------------------------------------------------------------ */
export const taskUsersDB = {
  getUserTaskById,
  getUserTaskByUserAndTask,
  addUserTask,
  addUserTaskTx,
  updateUserTaskById,
  updateUserTaskByUserAndTask,
  getUserTasksByUserAndTaskIds,
};
