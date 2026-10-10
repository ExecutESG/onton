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
import { authEngine } from "@/lib/auth/authEngine";
import { userIdentitiesDB } from "@/db/modules/userIdentities.db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  /* 1️⃣  Pull PKCE verifier & info from Redis -------------------- */
  const saved = state ? await redisTools.getCache(`goauth:${state}`) : null;

  if (!saved || typeof saved !== "object" || !("codeVerifier" in saved) || !code) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const { codeVerifier, telegramUserId, source, returnUrl, redirectUri } = saved as {
    codeVerifier: string;
    telegramUserId?: number;
    source?: string;
    returnUrl: string;
    redirectUri?: string;
  };

  try {
    /* 2️⃣  Exchange code → access_token (using matching redirectUri) */
    const { access_token } = await exchangeCodeForTokenGoogle(code, codeVerifier, redirectUri);

    /* 3️⃣  Fetch Google profile (sub, email, name, picture …) ---------- */
    const ui = await fetchGoogleUserInfo(access_token);

    let userId = telegramUserId;
    let platformToken: string | undefined;

    if (source === "web") {
      // Modern unified multi-provider resolution / creation
      const resolved = await authEngine.resolveOrCreateUser({
        provider: "google",
        providerUserId: ui.sub,
        email: ui.email,
        name: ui.name || `${ui.given_name || ""} ${ui.family_name || ""}`.trim() || "Google User",
        avatarUrl: ui.picture,
        metadata: ui,
      });

      userId = resolved.user.user_id;
      platformToken = resolved.token;
    }

    if (!userId) {
      return new Response("Unauthorized: missing user context", { status: 401 });
    }

    /* 4️⃣  Upsert mapping in user_identities & users_google ----- */
    const linkRes = await userIdentitiesDB.linkIdentity(userId, "google", ui.sub, {
      email: ui.email,
      name: ui.name,
      picture: ui.picture,
    });

    if (!linkRes.success) {
      let targetUrl = returnUrl;
      try {
        const parsed = new URL(targetUrl);
        parsed.searchParams.set("error", "identity_already_linked");
        targetUrl = parsed.toString();
      } catch (e) {
        logger.error("Failed to parse targetUrl in linkIdentity failure", { err: e });
      }
      await redisTools.deleteCache(`goauth:${state}`);
      
      const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      const forwardedProto = req.headers.get("x-forwarded-proto") || (forwardedHost.includes("localhost") ? "http" : "https");
      const publicBase = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : (process.env.NEXT_PUBLIC_APP_BASE_URL || "");
        
      return NextResponse.redirect(new URL(targetUrl, publicBase));
    }

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

      let targetUrl = returnUrl;
      const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      const forwardedProto = req.headers.get("x-forwarded-proto") || (forwardedHost.includes("localhost") ? "http" : "https");
      const publicBase = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : (process.env.NEXT_PUBLIC_APP_BASE_URL || "");

      if (publicBase && (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) && !forwardedHost.includes("localhost")) {
        try {
          const parsed = new URL(targetUrl);
          targetUrl = `${publicBase}${parsed.pathname}${parsed.search}`;
        } catch {
          targetUrl = publicBase || "/";
        }
      }

      // Determine shared root domain for subdomains (.onton.live)
      let cookieDomain: string | undefined = undefined;
      const hostToCheck = forwardedHost.toLowerCase().split(":")[0];
      if (hostToCheck.endsWith("onton.live")) {
        cookieDomain = ".onton.live";
      }

      const response = NextResponse.redirect(new URL(targetUrl, publicBase));

      const isProd = process.env.NODE_ENV === "production" || !forwardedHost.includes("localhost");
      const cookieOptions = {
        secure: isProd,
        sameSite: "lax" as const,
        path: "/",
        domain: cookieDomain,
        maxAge: 7 * 24 * 60 * 60, // 7 days
      };

      // Set httpOnly session cookie
      response.cookies.set("onton_session", sessionToken, {
        ...cookieOptions,
        httpOnly: true,
      });

      // Set platform tokens for client-side API/tRPC and legacy handlers
      if (platformToken) {
        response.cookies.set("onton_token", platformToken, {
          ...cookieOptions,
          httpOnly: false, // Accessible to client JS for Authorization headers
        });
        response.cookies.set("token", platformToken, {
          ...cookieOptions,
          httpOnly: true,
        });
      }

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
