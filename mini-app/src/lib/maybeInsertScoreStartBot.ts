import { tasksDB } from "@/db/modules/tasks.db";
import { userScoreDb } from "@/db/modules/userScore.db";
import { userScoreRulesDB } from "@/db/modules/userScoreRules.db";
import { logger } from "@/server/utils/logger";

/** give points when a user finishes the “start_bot” quest */
export async function maybeInsertScoreStartBot(userId: number, taskId: number) {
  /* 1. read the task to get default rewardPoint */
  const task = await tasksDB.getTaskById(taskId);
  if (!task) {
    logger.warn(`[StartBotScore] task ${taskId} not found`);
    return;
  }
  let points = task.rewardPoint; // default from DB

  /* 2. check custom rule override */
  try {
    const rule = await userScoreRulesDB.getMatchingUserScoreRule({
      subjectUserId: userId,
      activityType: "start_bot",
      itemType: "task",
      itemId: taskId,
    });
    if (rule) {
      points = parseFloat(rule.point);
      logger.log(`[StartBotScore] rule ${rule.id} overrides points → ${points}`);
    }
  } catch (e) {
    logger.error("custom rule fetch failed", e);
  }

  /* 3. insert users_score if not yet existing */
  try {
    await userScoreDb.createUserScore({
      userId,
      activityType: "start_bot",
      point: points,
      active: true,
      itemId: taskId,
      itemType: "task",
    });
    logger.log(`[StartBotScore] +${points} pts to user=${userId} for start_bot`);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("duplicate")) {
      logger.log("[StartBotScore] already rewarded, skip");
    } else {
      throw e;
    }
  }
}
