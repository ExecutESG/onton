// app/api/li/callback/route.ts
import { NextRequest } from "next/server";
import { redisTools } from "@/lib/redisTools";
import { exchangeCodeForTokenLinkedin, fetchLinkedinUserInfo } from "@/lib/linkedin";
import { usersLinkedinDB } from "@/db/modules/usersLinkedin.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { logger } from "@/server/utils/logger";
import { maybeInsertConnectTaskScore } from "@/lib/maybeInsertConnectTaskScore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  /* 1️⃣  Restore state from Redis */
  const cached = state ? await redisTools.getCache(`lioauth:${state}`) : null;
  if (!cached || typeof cached !== "object" || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }
  const { telegramUserId, returnUrl } = cached as {
    telegramUserId: number;
    returnUrl: string;
  };

  try {
    /* 2️⃣  Code → access_token */
    const { access_token } = await exchangeCodeForTokenLinkedin(code);

    /* 3️⃣  Fetch userinfo (OIDC) */
    const ui = await fetchLinkedinUserInfo(access_token);
    // ui = { sub, given_name, family_name, email, picture }

    /* 4️⃣  Upsert mapping in users_linkedin */
    await usersLinkedinDB.upsertLinkedinAccount({
      userId: telegramUserId,
      liUserId: ui.sub,
      liFirstName: ui.given_name,
      liLastName: ui.family_name,
      liAvatarUrl: ui.picture ?? undefined,
      liEmail: ui.email ?? undefined,
    });

    /* --------------------------------------------------------------------
       5️⃣  Mark the “LinkedIn Connect” quest as DONE
    -------------------------------------------------------------------- */
    const [liTask] = await tasksDB.getTasksByType("linked_in_connect", false);

    if (liTask) {
      const existing = await taskUsersDB.getUserTaskByUserAndTask(telegramUserId, liTask.id);

      if (existing) {
        await taskUsersDB.updateUserTaskById(existing.id, { status: "done" });
      } else {
        await taskUsersDB.addUserTask({
          userId: telegramUserId,
          taskId: liTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: {
            liUserId: ui.sub,
            liFirstName: ui.given_name,
            liLastName: ui.family_name,
            liEmail: ui.email ?? undefined,
          },
        });
        await maybeInsertConnectTaskScore(telegramUserId, "linked_in_connect");
      }
    } else {
      logger.warn("LinkedIn callback: no linked_in_connect task configured");
    }

    /* 6️⃣  Clean up Redis & redirect */
    await redisTools.deleteCache(`lioauth:${state}`);
    return Response.redirect(returnUrl, 302);
  } catch (err) {
    logger.error("LinkedIn OIDC callback error", err);
    return new Response("OAuth error", { status: 500 });
  }
}
