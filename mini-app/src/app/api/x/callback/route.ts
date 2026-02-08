// app/api/x/callback/route.ts
import { NextRequest } from "next/server";
import { redisTools } from "@/lib/redisTools";
import { exchangeCodeForToken, fetchMe } from "@/lib/twitter";
import { usersXDB } from "@/db/modules/usersX.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { logger } from "@/server/utils/logger";
import { maybeInsertConnectTaskScore } from "@/lib/maybeInsertConnectTaskScore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  /* 1️⃣  pull verifier + Telegram‑user from Redis */
  const saved = state ? await redisTools.getCache(`xoauth:${state}`) : null;

  if (!saved || typeof saved !== "object" || !("codeVerifier" in saved) || !("telegramUserId" in saved) || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const { codeVerifier, telegramUserId, returnUrl } = saved as {
    codeVerifier: string;
    telegramUserId: number;
    returnUrl: string;
  };

  try {
    /* 2️⃣  exchange code → access_token (Twitter API) */
    const { access_token } = await exchangeCodeForToken(code, codeVerifier);

    /* 3️⃣  fetch X profile (id, username, name, avatar …) */
    const profile = await fetchMe(access_token);

    /* 4️⃣  upsert mapping in users_x table */
    await usersXDB.upsertXAccount({
      userId: telegramUserId,
      xUserId: profile.id,
      xUsername: profile.username,
      xDisplayName: profile.name,
      xProfileImageUrl: profile.profile_image_url,
    });

    /* ------------------------------------------------------------------
       5️⃣  mark the “X Connect” quest DONE in users_task
    ------------------------------------------------------------------ */
    const [xTask] = await tasksDB.getTasksByType("x_connect", false);

    if (xTask) {
      const existing = await taskUsersDB.getUserTaskByUserAndTask(telegramUserId, xTask.id);

      if (existing) {
        await taskUsersDB.updateUserTaskById(existing.id, { status: "done" });
      } else {
        await taskUsersDB.addUserTask({
          userId: telegramUserId,
          taskId: xTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: { xUserId: profile.id, xUsername: profile.username },
        });
        await maybeInsertConnectTaskScore(telegramUserId, "x_connect");
      }
    } else {
      logger.warn("X callback: no x_connect task configured");
    }

    /* 6️⃣  clean Redis + redirect mini‑app */
    await redisTools.deleteCache(`xoauth:${state}`);
    return Response.redirect(returnUrl, 302);
  } catch (err) {
    logger.error("Twitter/X OAuth callback error", err);
    return new Response("OAuth error", { status: 500 });
  }
}
