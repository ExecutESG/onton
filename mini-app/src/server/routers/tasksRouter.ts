// tasksRouter.ts
import { initDataProtectedProcedure, router } from "../trpc";
import { z } from "zod";
import { logger } from "@/server/utils/logger";

import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { Tasks, TaskUsers } from "@/db/schema";
import { taskTypeEnum } from "@/db/schema/tasks";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { generateRandomHash } from "@/lib/generateRandomHash";
import { TRPCError } from "@trpc/server";
import telegramService from "@/services/telegramService";

/**
 * Merge user status via a single "WHERE taskId IN (..)" DB query
 * from the `users_task` table.
 */
export interface MergedTask extends Tasks {
  userTaskStatus: TaskUsers | null;
}

/**
 * mergeUserStatus:
 * - Takes an array of `Tasks` plus a `userId`.
 * - Loads `TaskUsers` rows matching that user & those task IDs.
 * - Returns a **Promise** resolving to an array of `MergedTask`.
 */
export async function mergeUserStatus(tasks: Tasks[], userId: number): Promise<MergedTask[]> {
  // If no tasks, return an empty array (or the original tasks as a fallback).
  if (tasks.length === 0) {
    // Convert each `Tasks` to `MergedTask` with `null` userTaskStatus
    return tasks.map((t) => ({ ...t, userTaskStatus: null }));
  }

  // 1) Gather all task IDs
  const taskIds = tasks.map((t) => t.id);

  // 2) Fetch matching user-task rows
  const userTasks = await taskUsersDB.getUserTasksByUserAndTaskIds(userId, taskIds);

  // 3) Build a map of { taskId -> TaskUsers }
  const map = new Map<number, TaskUsers>();
  for (const ut of userTasks) {
    map.set(ut.taskId, ut);
  }

  // 4) Return merged array
  const merged: MergedTask[] = tasks.map((task) => ({
    ...task,
    userTaskStatus: map.get(task.id) || null,
  }));

  return merged;
}

export const tasksRouter = router({
  /**
   * Example 1: getTasksByType
   * Input: { taskType, onlyAvailableNow }
   * Returns tasks from tasksDB, merges user status
   */
  getTasksByType: initDataProtectedProcedure
    .input(
      z.object({
        taskType: z.enum(taskTypeEnum.enumValues),
        onlyAvailableNow: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.user_id;
      const { taskType, onlyAvailableNow } = input;
      try {
        const typedTasks = await tasksDB.getTasksByType(taskType, onlyAvailableNow);
        const tasksWithStatus = await mergeUserStatus(typedTasks, userId);

        return { success: true, tasks: tasksWithStatus };
      } catch (error) {
        logger.error("tasksRouter.getTasksByType error:", error);
        return { success: false, tasks: [], message: "Error fetching tasks by type" };
      }
    }),

  /**
   * Example 2: getTasksByGroup (with manual time filtering or optional param)
   *
   * If you want to also handle date/time in the DB, you could add
   * a "getTasksByGroupIdAndAvailableNow(groupId)" method to tasksDB.
   */
  getTasksByGroup: initDataProtectedProcedure.input(z.object({ groupId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.user_id;
    const { groupId } = input;

    try {
      const groupTasks = await tasksDB.getTasksByGroupId(groupId);

      // If you want to filter by "available now" in the code:
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const validNow = groupTasks.filter((t) => {
        // Basic date/time check. Or do it in tasksDB with a method "getTasksByGroupIdAndAvailableNow"
        if (t.openDate && todayStr < t.openDate.toString().split("T")[0]) return false;
        if (t.closeDate && todayStr > t.closeDate.toString().split("T")[0]) return false;
        if (t.openTime && timeStr < t.openTime) return false;
        if (t.closeTime && timeStr > t.closeTime) return false;
        return true;
      });

      if (validNow.length === 0) {
        return { success: true, tasks: null, message: "No tasks available now in this group" };
      }

      const tasksWithStatus = await mergeUserStatus(validNow, userId);
      return { success: true, tasks: tasksWithStatus };
    } catch (error) {
      logger.error("tasksRouter.getTasksByGroup error:", error);
      return { success: false, tasks: null, message: "Error fetching tasks by group" };
    }
  }),

  /**
   * Example 3: getAvailablePeriodTasks
   * Calls tasksDB.getTasksAvailableNow to handle date/time filtering in DB,
   * merges user status.
   */
  getAvailablePeriodTasks: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.user_id;

    try {
      const tasksAvail = await tasksDB.getTasksAvailableNow();
      const tasksWithStatus = await mergeUserStatus(tasksAvail, userId);

      return { success: true, tasks: tasksWithStatus };
    } catch (error) {
      logger.error("tasksRouter.getAvailablePeriodTasks error:", error);
      return { success: false, tasks: [], message: "Error fetching available tasks" };
    }
  }),
  /**
   * getOntonJoinAffiliateData
   * 1) Find exactly one task with:
   *    task_type = 'affiliation'
   *    task_connected_item_types = 'join_onton'
   * 2) If not found or multiple found, throw an error.
   * 3) Create/fetch affiliate link for user
   * 4) Create/update userTask record, storing affiliateHash in customData.
   * 5) Return link + userTaskId + joinedCount
   */
  getOntonJoinAffiliateData: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.user_id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No user found in context",
      });
    }

    // 1) Find the 'affiliation' task with connected_item_types = 'join_onton'
    const tasks = await tasksDB.getTasksByType("affiliation", false);
    const joinOntonTasks = tasks.filter((t) => t.taskConnectedItemTypes === "join_onton");

    if (joinOntonTasks.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No 'affiliation' task found with 'join_onton'. Please configure one.",
      });
    }
    if (joinOntonTasks.length > 1) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Multiple 'join_onton' tasks found. Please ensure exactly one is set up.",
      });
    }

    const joinOntonTask = joinOntonTasks[0];
    const taskId = joinOntonTask.id;

    // 2) Get or Create affiliate link
    let link = await affiliateLinksDB.getAffiliateLinkForType(userId, "onton-join-task");
    if (!link) {
      const linkHash = generateRandomHash(8);
      link = await affiliateLinksDB.createAffiliateLinkByType(
        `join-onton-by-${userId}`,
        "onton-join-task",
        userId,
        linkHash,
        "onton-join-task"
      );
      if (!link) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create affiliate link for userId ${userId}`,
        });
      }
      logger.log(`Created affiliate link for userId=${userId}, linkHash=${link.linkHash}`);
    }

    // 3) Build full Telegram link
    const botUserName = process.env.NEXT_PUBLIC_BOT_USERNAME || "theontonbot";
    const fullLink = `https://t.me/${botUserName}/event?startapp=join-${link.linkHash}`;

    // 4) Insert/Update users_task record with affiliateHash in customData
    //  E.g.: { ...customData, affiliateHash: link.linkHash }
    let userTask = await taskUsersDB.getUserTaskByUserAndTask(userId, taskId);
    if (!userTask) {
      // Insert a new record
      userTask = await taskUsersDB.addUserTask({
        userId,
        taskId,
        status: "in_progress",
        pointStatus: "not_allocated",
        taskSbt: "has_not_sbt",
        groupSbt: "has_not_sbt",
        customData: { affiliateHash: link.linkHash },
      });
    }

    // 5) joined count might be link.totalPurchase or your logic
    const joinedCount = link.totalPurchase || 0;

    return {
      linkHash: fullLink,
      joined: joinedCount,
      userTaskId: userTask?.id,
    };
  }),
  requestShareJoinOntonAffiliate: initDataProtectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user?.user_id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No user found" });
    }

    // 1) Fetch or create the affiliate link for "onton-join-task"
    const link = await affiliateLinksDB.getAffiliateLinkForType(userId, "onton-join-task");
    if (!link) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `No affiliate link found or created for user #${userId} with 'onton-join-task'.`,
      });
    }

    const linkHash = link.linkHash;
    const shareLink = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=join-${linkHash}`;
    const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/join-onton/?affiliate=${linkHash}`;

    // 2) Prepare data
    const affiliateDataForBot = {
      linkHash,
      imageUrl: "https://mohammad-storage.toncloud.observer/campaign/photo_2025-04-01_08-41-17.jpg",
      // any other fields, e.g. totalSpins or totalPurchase if relevant
    };

    // 3) Call telegram service
    const result = await telegramService.shareJoinOntonAffiliateLinkRequest(
      userId.toString(),
      linkHash,
      shareLink,
      fallbackUrl,
      affiliateDataForBot
    );
    logger.info("requestShareJoinOntonAffiliate => ", result);

    if (result.success) {
      return { status: "success", data: null };
    } else {
      logger.error(`requestShareJoinOntonAffiliate: Failed to share the affiliate link for user #${userId}:`, result.error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to share join-onton link",
        cause: result.error,
      });
    }
  }),
});
