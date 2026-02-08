import { userScoreDb } from "@/db/modules/userScore.db";
import { userScoreRulesDB } from "@/db/modules/userScoreRules.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { logger } from "@/server/utils/logger";

/**
 * Award points once the quest is marked “done”.
 *  – gets default from tasks.rewardPoint
 *  – overrides if a custom rule exists
 */
export async function maybeInsertScoreGeneric(userId: number, taskId: number) {
  /* 1) load task (for rewardPoint & type) */
  const task = await tasksDB.getTaskById(taskId);
  if (!task) {
    logger.warn(`[Quest‑Score] task #${taskId} not found`);
    return;
  }

  /* 2) start with default */
  let points = task.rewardPoint;

  /* 3) custom rule? (activityType == task_type) */
  try {
    const rule = await userScoreRulesDB.getMatchingUserScoreRule({
      subjectUserId: userId,
      activityType: task.taskType as any, // both enums share values
      itemType: "task",
      itemId: taskId,
    });
    if (rule) points = parseFloat(rule.point);
  } catch (e) {
    logger.error("Failed to fetch userScore rule, using default", e);
  }

  /* 4) insert users_score (ignore duplicates) */
  try {
    await userScoreDb.createUserScore({
      userId,
      activityType: task.taskType as any,
      point: points,
      active: true,
      itemId: taskId,
      itemType: "task",
    });
    logger.log(`[Quest‑Score] +${points} for user=${userId} task=${taskId}`);
  } catch (e) {
    if (String(e).includes("duplicate key")) {
      logger.log(`[Quest‑Score] already awarded (user=${userId}, task=${taskId})`);
    } else {
      throw e;
    }
  }
}
