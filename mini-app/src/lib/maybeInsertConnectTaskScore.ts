// src/db/modules/maybeInsertConnectTaskScore.ts
import { tasksDB } from "@/db/modules/tasks.db";
import { userScoreDb } from "@/db/modules/userScore.db";
import { userScoreRulesDB } from "@/db/modules/userScoreRules.db";
import { UsersScoreActivityType } from "@/db/schema/usersScore";
import { logger } from "@/server/utils/logger";
import { TaskTypeType } from "@/db/schema/tasks";

export type MaybeInsertConnectScoreResult = { point: number; error: null } | { point: number | null; error: string };

/**
 * Awards points for X / GitHub / LinkedIn “connect” quests.
 *
 * • `taskType` must be TaskTypeType
 * • Points default to `rewardPoint` in the `tasks` row.
 * • If a custom user‑score rule matches, that rule overrides the point value.
 * • If a score already exists (unique constraint), nothing is inserted.
 */
export async function maybeInsertConnectTaskScore(
  userId: number,
  taskType: TaskTypeType
): Promise<MaybeInsertConnectScoreResult> {
  /* 1️⃣  Find the single task definition */
  const [task] = await tasksDB.getTasksByType(taskType, false);
  if (!task) {
    const msg = `No task row found for task_type=${taskType}`;
    logger.warn(`[ConnectScore] ${msg}`);
    return { point: null, error: msg };
  }

  let points = task.rewardPoint; // default (integer in DB)

  /* 2️⃣  Override via custom rule if present */
  try {
    const rule = await userScoreRulesDB.getMatchingUserScoreRule({
      subjectUserId: userId,
      activityType: taskType as UsersScoreActivityType,
      itemType: "task",
      itemId: task.id,
    });

    if (rule) {
      points = parseFloat(rule.point);
      logger.log(`[ConnectScore] Rule ${rule.id} overrides default: ${task.rewardPoint} ➜ ${points} (${taskType})`);
    }
  } catch (err) {
    logger.error("[ConnectScore] Failed fetching custom rule; using default", err);
  }

  /* 3️⃣  Insert users_score row (or ignore duplicate) */
  try {
    await userScoreDb.createUserScore({
      userId,
      activityType: taskType as UsersScoreActivityType,
      point: points,
      active: true,
      itemId: task.id,
      itemType: "task",
    });
    logger.log(`[ConnectScore] +${points} for user=${userId} (${taskType})`);
    return { point: points, error: null };
  } catch (err: any) {
    const m = String(err);
    if (m.includes("duplicate") || m.includes("unique constraint")) {
      logger.log(`[ConnectScore] score already exists for user=${userId} ${taskType}`);
      return { point: 0, error: "Score already exists" };
    }
    logger.error(`[ConnectScore] unexpected error: ${m}`);
    return { point: null, error: m };
  }
}
