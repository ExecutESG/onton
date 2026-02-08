import { tasksDB } from "@/db/modules/tasks.db";
import { userScoreDb } from "@/db/modules/userScore.db";
import { userScoreRulesDB } from "@/db/modules/userScoreRules.db";
import { logger } from "@/server/utils/logger";

/** identical signature to the Start‑Bot helper */
export async function maybeInsertScoreXViewPost(userId: number, taskId: number) {
  /* 1) load the task  */
  const task = await tasksDB.getTaskById(taskId);
  if (!task) {
    logger.warn(`[maybeInsertScoreViewPost] task ${taskId} not found`);
    return;
  }

  /* 2) default points from column  */
  let points = task.rewardPoint ?? 0;

  /* 3) custom rule override (same precedence as before) */
  try {
    const rule = await userScoreRulesDB.getMatchingUserScoreRule({
      subjectUserId: userId,
      activityType: "x_view_post", // be sure you have this value in the enum
      itemType: "task",
      itemId: taskId,
    });
    if (rule) points = parseFloat(rule.point);
  } catch (err) {
    logger.error("ViewPost: rule lookup failed", err);
  }

  /* 4) write the users_score row (ignore dupes) */
  try {
    await userScoreDb.createUserScore({
      userId,
      activityType: "x_view_post",
      point: points,
      active: true,
      itemId: taskId,
      itemType: "task",
    });
  } catch (err) {
    if (String(err).includes("duplicate")) return; // already got points
    logger.error("ViewPost: score insert failed", err);
  }
}
