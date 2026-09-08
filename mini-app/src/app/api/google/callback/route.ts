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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { users } from "@/db/schema/users";
import { usersDB } from "@/db/modules/users.db";
import { createWebSessionToken } from "@/server/utils/jwt";
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

  /* 1️⃣  Pull PKCE verifier & info from Redis -------------------- */
  const saved = state ? await redisTools.getCache(`goauth:${state}`) : null;

  if (!saved || typeof saved !== "object" || !("codeVerifier" in saved) || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const { codeVerifier, telegramUserId, source, returnUrl } = saved as {
    codeVerifier: string;
    telegramUserId?: number;
    source?: string;
    returnUrl: string;
  };

  try {
    /* 2️⃣  Exchange code → access_token -------------------------------- */
    const { access_token } = await exchangeCodeForTokenGoogle(code, codeVerifier);

    /* 3️⃣  Fetch Google profile (sub, email, name, picture …) ---------- */
    const ui = await fetchGoogleUserInfo(access_token);

    let userId = telegramUserId;

    if (source === "web") {
      // Look up existing Google account mapping
      const existingUserId = await usersGoogleDB.getUserIdByGoogleUserId(ui.sub);
      if (existingUserId) {
        userId = existingUserId;
      } else {
        // Create new web-only user row
        let isUnique = false;
        let generatedId = 0;
        while (!isUnique) {
          generatedId = 1e14 + Math.floor(Math.random() * 1e12);
          const existing = await usersDB.selectUserById(generatedId);
          if (!existing) isUnique = true;
        }
        userId = generatedId;

        await db
          .insert(users)
          .values({
            user_id: userId,
            username: ui.email ? ui.email.split("@")[0] + "_g" : `web_${userId}`,
            first_name: ui.given_name || ui.name || "Web",
            last_name: ui.family_name || "User",
            language_code: "en",
            role: "user",
            photo_url: ui.picture || null,
          })
          .onConflictDoNothing()
          .execute();
      }
    }

    if (!userId) {
      return new Response("Unauthorized: missing user context", { status: 401 });
    }

    /* 4️⃣  Upsert mapping in users_google ------------------------------ */
    await usersGoogleDB.upsertGoogleAccount({
      userId: userId,
      gUserId: ui.sub,
      gEmail: ui.email,
      gDisplayName: ui.name,
      gAvatarUrl: ui.picture,
    });

    if (source === "web") {
      /* Cleanup Redis + redirect to web with session cookie ---------- */
      await redisTools.deleteCache(`goauth:${state}`);

      const sessionToken = await createWebSessionToken({
        userId: userId,
        authMethod: "google",
      });

      const response = NextResponse.redirect(returnUrl);
      response.cookies.set("onton_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
      return response;
    }

    /* 5️⃣  Mark the “Google Connect” quest DONE + award points --------- */
    const [gTask] = await tasksDB.getTasksByType("google_connect", false);

    if (gTask) {
      const existing = await taskUsersDB.getUserTaskByUserAndTask(userId, gTask.id);

      if (existing) {
        await taskUsersDB.updateUserTaskById(existing.id, { status: "done" });
      } else {
        await taskUsersDB.addUserTask({
          userId: userId,
          taskId: gTask.id,
          status: "done",
          pointStatus: "not_allocated",
          taskSbt: "has_not_sbt",
          groupSbt: "has_not_sbt",
          customData: { gUserId: ui.sub, gEmail: ui.email },
        });
        await maybeInsertConnectTaskScore(userId, "google_connect");
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
