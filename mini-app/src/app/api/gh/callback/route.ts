// app/api/gh/callback/route.ts
import { NextRequest } from "next/server";
import { redisTools } from "@/lib/redisTools";
import { exchangeCodeForTokenGithub, fetchGithubUser } from "@/lib/github";
import { usersGithubDB } from "@/db/modules/usersGithub.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { logger } from "@/server/utils/logger";
import { maybeInsertConnectTaskScore } from "@/lib/maybeInsertConnectTaskScore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  /* 1️⃣  Pull cached Telegram‑user & returnUrl */
  const saved = state ? await redisTools.getCache(`ghoauth:${state}`) : null;
  if (!saved || typeof saved !== "object" || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }
  const { telegramUserId, returnUrl } = saved as {
    telegramUserId: number;
    returnUrl: string;
  };

  try {
    /* 2️⃣  Exchange code → access_token */
    const { access_token } = await exchangeCodeForTokenGithub(code);

    /* 3️⃣  Fetch profile */
    const profile = await fetchGithubUser(access_token);
    // { id, login, name, avatar_url }

    /* 4️⃣  Upsert into users_github */
    await usersGithubDB.upsertGithubAccount({
      userId: telegramUserId,
      ghUserId: profile.id.toString(),
      ghLogin: profile.login,
      ghDisplayName: profile.name ?? undefined,
      ghAvatarUrl: profile.avatar_url ?? undefined,
    });

    /* ------------------------------------------------------------------
       5️⃣  Mark the “GitHub Connect” quest as DONE
    ------------------------------------------------------------------ */
    const [ghTask] = await tasksDB.getTasksByType("github_connect", false);

    if (ghTask) {
      const existing = await taskUsersDB.getUserTaskByUserAndTask(telegramUserId, ghTask.id);

      if (existing) {
        await taskUsersDB.updateUserTaskById(existing.id, { status: "done" });
      } else {
        await taskUsersDB.addUserTask({
          userId: telegramUserId,
          taskId: ghTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: { ghUserId: profile.id.toString(), ghLogin: profile.login },
        });
        await maybeInsertConnectTaskScore(telegramUserId, "github_connect");
      }
    } else {
      logger.warn("GitHub callback: no github_connect task configured");
    }

    /* 6️⃣  Clean Redis + redirect */
    await redisTools.deleteCache(`ghoauth:${state}`);
    return Response.redirect(returnUrl, 302);
  } catch (err) {
    logger.error("GitHub OAuth callback error", err);
    return new Response("OAuth error", { status: 500 });
  }
}
