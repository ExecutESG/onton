import { validateMiniAppData } from "@/utils";
import { usersDB } from "@/db/modules/users.db";
import { logger } from "@/server/utils/logger";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";
import { getAuthenticatedUserApi } from "@/server/userApiKeyAuth";
import { selectUserById } from "@/db/modules/users.db";
import { verifyPlatformToken } from "@/server/utils/jwt";

export async function createContext({ req }: { req: Request }) {
  // 1. Get user from header (Bearer Platform JWT or Telegram initData)
  async function getUserFromHeader() {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;

    // Check for Bearer JWT token (modern Web, Mobile, or API callers)
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = await verifyPlatformToken(token);
        if (payload?.userId) {
          const user = await selectUserById(payload.userId);
          if (user) {
            if (user.role === "ban") {
              throw new TRPCError({ code: "FORBIDDEN", message: "user is banned" });
            }
            return user;
          }
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error("Error in Bearer token auth in context: ", err);
      }
      return null;
    }

    // Telegram initData verification (Telegram Mini App fallback)
    const initData = authHeader;
    const { valid, initDataJson } = validateMiniAppData(initData);
    if (!valid) {
      logger.info("Invalid init data", { initData });
      return null;
    }

    let joinAffiliateHash = undefined;
    if (typeof initDataJson?.start_param === "string" && initDataJson?.start_param.startsWith("join-")) {
      const startParam = initDataJson.start_param.split("-");
      joinAffiliateHash = startParam[1];
    }

    const user = await usersDB.insertUser(initDataJson, joinAffiliateHash);
    if (!user) {
      logger.info("User not found", { initDataJson });
      return null;
    }

    if (user.role === "ban") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "user is banned",
      });
    }

    return user;
  }

  // 2. Get user from web cookie session (onton_token, onton_session, or token)
  async function getUserFromWebSession() {
    try {
      let tokenVal: string | undefined;

      try {
        const cookieStore = cookies();
        const sessionCookie =
          cookieStore.get("onton_token") ||
          cookieStore.get("onton_session") ||
          cookieStore.get("token");
        tokenVal = sessionCookie?.value;
      } catch {}

      // Fallback: parse raw cookie header from Request if Next cookies() returned empty/failed
      if (!tokenVal) {
        const rawCookieHeader = req.headers.get("cookie");
        if (rawCookieHeader) {
          const cookiePairs = rawCookieHeader.split(";").map((p) => p.trim());
          for (const pair of cookiePairs) {
            const [k, ...v] = pair.split("=");
            const key = k?.trim();
            const val = v.join("=").trim();
            if (key === "onton_token" || key === "onton_session" || key === "token") {
              tokenVal = decodeURIComponent(val);
              break;
            }
          }
        }
      }

      if (tokenVal) {
        const payload = await verifyPlatformToken(tokenVal);
        if (payload && typeof payload.userId === "number") {
          const user = await selectUserById(payload.userId);
          if (user) {
            if (user.role === "ban") {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "user is banned",
              });
            }
            return user;
          }
        }
      }
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      logger.error("Error in getUserFromWebSession: ", err);
    }
    return null;
  }

  // 3. Helper to get user via API Key (Fallback if tokens are missing)
  async function getUserFromApiKey() {
    const [userId, _err] = await getAuthenticatedUserApi(req);

    if (userId) {
      const user = await selectUserById(userId);
      if (user) {
        // Ensure user is not banned
        if (user.role === "ban") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "user is banned",
          });
        }
        return user;
      }
    }
    return null;
  }

  let user = await getUserFromHeader();

  if (!user) {
    user = await getUserFromWebSession();
  }

  if (!user) {
    user = await getUserFromApiKey();
  }

  return {
    req, // ← important! (Next Request passed into context)
    user,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
