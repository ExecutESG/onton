import { NextRequest } from "next/server";
import { redisTools } from "@/lib/redisTools";
import { exchangeCodeForMsToken, fetchOutlookProfile } from "@/lib/outlook";
import { usersOutlookDB } from "@/db/modules/usersOutlook.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { maybeInsertConnectTaskScore } from "@/lib/maybeInsertConnectTaskScore";
import { logger } from "@/server/utils/logger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const saved = state ? await redisTools.getCache(`msoauth:${state}`) : null;
  if (!saved || typeof saved !== "object" || !code) return new Response("Invalid state", { status: 400 });

  const { codeVerifier, telegramUserId, returnUrl } = saved as {
    codeVerifier: string;
    telegramUserId: number;
    returnUrl: string;
  };

  try {
    const { access_token } = await exchangeCodeForMsToken(code, codeVerifier);
    const p = await fetchOutlookProfile(access_token);

    await usersOutlookDB.upsertOutlookAccount({
      userId: telegramUserId,
      msUserId: p.id,
      msDisplayName: p.displayName,
      msGivenName: p.givenName,
      msSurname: p.surname,
      msUserPrincipalName: p.userPrincipalName,
    });

    /* mark quest done + score */
    const [msTask] = await tasksDB.getTasksByType("outlook_connect", false);
    if (msTask) {
      const prev = await taskUsersDB.getUserTaskByUserAndTask(telegramUserId, msTask.id);
      if (prev) await taskUsersDB.updateUserTaskById(prev.id, { status: "done" });
      else {
        await taskUsersDB.addUserTask({
          userId: telegramUserId,
          taskId: msTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: { p },
        });
        await maybeInsertConnectTaskScore(telegramUserId, "outlook_connect");
      }
    }

    await redisTools.deleteCache(`msoauth:${state}`);
    return Response.redirect(returnUrl, 302);
  } catch (e) {
    logger.error("Outlook OAuth cb", e);
    console.log(e);
    return new Response("OAuth error", { status: 500 });
  }
}
