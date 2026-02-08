// src/server/routers/questRouter.ts
import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { maybeInsertScoreGeneric } from "@/lib/maybeInsertScoreGeneric";

const DELAY_MS = 30_000;

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

    const elapsed = Date.now() - new Date(ut.createdAt).getTime();
    if (elapsed >= DELAY_MS) {
      await taskUsersDB.updateUserTaskById(ut.id, { status: "done" });
      await maybeInsertScoreGeneric(userId, taskId);
      return { status: "done" } as const;
    }

    return { status: "waiting" } as const;
  }),
});
