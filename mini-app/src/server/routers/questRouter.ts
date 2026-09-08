// src/server/routers/questRouter.ts
import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { maybeInsertScoreGeneric } from "@/lib/maybeInsertScoreGeneric";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";
import { tgSafeCall } from "@/utils/tgSafeCall";
import { Bot } from "grammy";
import { MAIN_TG_CHANNEL_ID, MAIN_TG_CHAT_ID } from "@/constants";
import { logger } from "@/server/utils/logger";

const DELAY_MS = 30_000;

async function checkTelegramMembership(userId: number, target: string | number): Promise<boolean | null> {
  try {
    let token: string | null = null;
    try {
      const { configProtected } = await fetchOntonSettings();
      token = (configProtected?.["check_join_bot_token"] as string) || process.env.BOT_TOKEN || null;
    } catch {
      token = process.env.BOT_TOKEN || null;
    }

    if (!token) return null;

    const bot = new Bot(token);
    const { data: chatMember, error } = await tgSafeCall(() => bot.api.getChatMember(target, userId));

    if (error || !chatMember) {
      logger.warn(`Could not check chat member for user ${userId} in ${target}: ${error?.message}`);
      return null;
    }

    const memberStatuses = ["member", "creator", "administrator", "restricted"];
    const isMember =
      memberStatuses.includes(chatMember.status) &&
      (chatMember.status === "restricted" ? (chatMember as any).is_member : true);

    return isMember;
  } catch (e) {
    logger.error("Error in checkTelegramMembership:", e);
    return null;
  }
}

/* -------------------------------------------------------------
 *  Resolve “link to open” based on task_type & json_for_checker
 * ----------------------------------------------------------- */
function resolveLink(task: NonNullable<Awaited<ReturnType<typeof tasksDB.getTaskById>>>) {
  const cfg = (task.jsonForChecker ?? {}) as any;

  switch (task.taskType) {
    case "start_bot":
      return `https://t.me/${cfg.bot_address ?? "theontonbot"}`;

    case "x_view_post":
    case "x_retweet":
    case "x_follow":
      if (!cfg.x_url) throw new Error("x_url missing");
      return cfg.x_url;

    case "tg_join_channel":
      if (!cfg.channel_username) throw new Error("channel_username missing");
      return `https://t.me/${cfg.channel_username}`;

    case "tg_join_group":
      if (!cfg.group_invite_link) throw new Error("group_invite_link missing");
      return cfg.group_invite_link;

    case "tg_post_view":
      if (!cfg.post_url) throw new Error("post_url missing");
      return cfg.post_url;

    case "open_mini_app":
      if (!cfg.webapp_url) throw new Error("webapp_url missing");
      return cfg.webapp_url;

    case "web_visit":
      if (!cfg.web_url) throw new Error("web_url missing");
      return cfg.web_url;
    default:
      throw new Error(`Quest type '${task.taskType}' unsupported`);
  }
}

export const questRouter = router({
  /* -------------------- BEGIN -------------------- */
  begin: initDataProtectedProcedure.input(z.object({ taskId: z.number() })).mutation(async ({ ctx, input }) => {
    const { taskId } = input;
    const userId = ctx.user.user_id;

    const task = await tasksDB.getTaskById(taskId);
    if (!task) throw new Error("Task not found");

    /* dependency gate */
    if (task.taskConnectedItemTypes === "task" && task.taskConnectedItem) {
      const parentId = Number(task.taskConnectedItem);
      const parentUT = await taskUsersDB.getUserTaskByUserAndTask(userId, parentId);
      if (!parentUT || parentUT.status !== "done") {
        const parentTask = await tasksDB.getTaskById(parentId);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Finish “${parentTask?.title ?? "required task"}” first`,
        });
      }
    }

    /* upsert users_task row */
    let ut = await taskUsersDB.getUserTaskByUserAndTask(userId, taskId);
    if (!ut) {
      ut = await taskUsersDB.addUserTask({
        userId,
        taskId,
        status: "in_progress",
        pointStatus: "not_allocated",
        taskSbt: "has_not_sbt",
        groupSbt: "has_not_sbt",
        customData: {},
      });
    }

    return { startBotLink: resolveLink(task) };
  }),

  /* -------------------- CHECK -------------------- */
  check: initDataProtectedProcedure.input(z.object({ taskId: z.number() })).query(async ({ ctx, input }) => {
    const { taskId } = input;
    const userId = ctx.user.user_id;

    const task = await tasksDB.getTaskById(taskId);
    if (!task) return { status: "no_task" } as const;

    const ut = await taskUsersDB.getUserTaskByUserAndTask(userId, taskId);
    if (!ut) return { status: "not_started" } as const;
    if (ut.status === "done") return { status: "done" } as const;

    // Real Telegram verification for channel and group quests
    if (task.taskType === "tg_join_channel" || task.taskType === "tg_join_group") {
      const cfg = (task.jsonForChecker ?? {}) as any;
      const target =
        task.taskType === "tg_join_channel"
          ? cfg.channel_id ??
            (cfg.channel_username
              ? cfg.channel_username.startsWith("@")
                ? cfg.channel_username
                : `@${cfg.channel_username}`
              : MAIN_TG_CHANNEL_ID)
          : cfg.group_id ??
            cfg.chat_id ??
            (cfg.group_username
              ? cfg.group_username.startsWith("@")
                ? cfg.group_username
                : `@${cfg.group_username}`
              : MAIN_TG_CHAT_ID);

      const isMember = await checkTelegramMembership(userId, target);

      if (isMember === true) {
        await taskUsersDB.updateUserTaskById(ut.id, { status: "done" });
        await maybeInsertScoreGeneric(userId, taskId);
        return { status: "done" } as const;
      }

      if (isMember === false) {
        // User has not joined the required channel/group yet
        return { status: "waiting" } as const;
      }
      // If isMember === null (e.g. bot not in private channel or API error), fall through to timer fallback
    }

    const elapsed = Date.now() - new Date(ut.createdAt).getTime();
    if (elapsed >= DELAY_MS) {
      await taskUsersDB.updateUserTaskById(ut.id, { status: "done" });
      await maybeInsertScoreGeneric(userId, taskId);
      return { status: "done" } as const;
    }

    return { status: "waiting" } as const;
  }),
});
