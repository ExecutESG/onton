/* --------------------------------------------------------------------------
 * Google OAuth 2.0 PKCE callback
 * --------------------------------------------------------------------------
 *  1) `state`     → restore { codeVerifier , telegramUserId , returnUrl }
 *  2) `code`      → exchange for access_token ( & id_token )
 *  3) accessToken → fetch OpenID‑Connect `/userinfo`
 *  4) Persist link in `users_google`
 *  5) Mark the “google_connect” quest **done** ( + award points )
 *  6) Cleanup Redis  →  redirect back to the mini‑app
 * ------------------------------------------------------------------------ */

import { NextRequest } from "next/server";

import { redisTools } from "@/lib/redisTools";
import { exchangeCodeForTokenGoogle, fetchGoogleUserInfo } from "@/lib/google";
import { usersGoogleDB } from "@/db/modules/usersGoogle.db";
import { tasksDB } from "@/db/modules/tasks.db";
import { taskUsersDB } from "@/db/modules/taskUsers.db";
import { maybeInsertConnectTaskScore } from "@/lib/maybeInsertConnectTaskScore";
import { logger } from "@/server/utils/logger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  /* 1️⃣  Pull PKCE verifier & TG‑user from Redis -------------------- */
  const saved = state ? await redisTools.getCache(`goauth:${state}`) : null;

  if (!saved || typeof saved !== "object" || !("codeVerifier" in saved) || !("telegramUserId" in saved) || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const { codeVerifier, telegramUserId, returnUrl } = saved as {
    codeVerifier: string;
    telegramUserId: number;
    returnUrl: string;
  };

  try {
    /* 2️⃣  Exchange code → access_token -------------------------------- */
    const { access_token } = await exchangeCodeForTokenGoogle(code, codeVerifier);

    /* 3️⃣  Fetch Google profile (sub, email, name, picture …) ---------- */
    const ui = await fetchGoogleUserInfo(access_token);

    /* 4️⃣  Upsert mapping in users_google ------------------------------ */
    await usersGoogleDB.upsertGoogleAccount({
      userId: telegramUserId,
      gUserId: ui.sub,
      gEmail: ui.email,
      gDisplayName: ui.name,
      gAvatarUrl: ui.picture,
    });

    /* 5️⃣  Mark the “Google Connect” quest DONE + award points --------- */
    const [gTask] = await tasksDB.getTasksByType("google_connect", false);

    if (gTask) {
      const existing = await taskUsersDB.getUserTaskByUserAndTask(telegramUserId, gTask.id);

      if (existing) {
        await taskUsersDB.updateUserTaskById(existing.id, { status: "done" });
      } else {
        await taskUsersDB.addUserTask({
          userId: telegramUserId,
          taskId: gTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: { gUserId: ui.sub, gEmail: ui.email },
        });
        await maybeInsertConnectTaskScore(telegramUserId, "google_connect");
      }
    } else {
      logger.warn("Google callback: no google_connect task configured");
    }

    /* 6️⃣  Cleanup Redis + redirect back to mini‑app ------------------- */
    await redisTools.deleteCache(`goauth:${state}`);
    return Response.redirect(returnUrl, 302);
  } catch (err) {
    logger.error("Google OAuth callback error" + (err instanceof Error ? `: ${err.message}` : ""), { err });
    console.log(err);
    return new Response("OAuth error", { status: 500 });
  }
}
