import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import { AuthToken, verifyToken, getAuthJwtSecret, PLATFORM_JWT_ALGORITHM } from "@/server/utils/jwt";
import { validateMiniAppData } from "@/utils";

export { apiKeyAuthentication, safeTimingEqual } from "@/server/apiKeyAuth";

/**
 * Validates authenticated user from session cookies or optional request headers.
 * Supports modern omnichannel platform tokens, Telegram initData, onton_session, and legacy bot-signed tokens.
 */
export function getAuthenticatedUser(req?: Request): [number, null] | [null, Response] {
  let tokenStr: string | undefined;

  // 1. Check headers if req is provided
  if (req) {
    const authHeader = req.headers.get("Authorization");
    const initDataHeader = req.headers.get("x-init-data");
    const rawInitData = initDataHeader || (authHeader && !authHeader.startsWith("Bearer ") ? authHeader : undefined);

    // Validate raw Telegram Mini App initData
    if (rawInitData) {
      const validation = validateMiniAppData(rawInitData);
      if (validation.valid && validation.initDataJson?.user?.id) {
        return [Number(validation.initDataJson.user.id), null];
      }
    }

    // Check Authorization: Bearer <token>
    if (authHeader && authHeader.startsWith("Bearer ")) {
      tokenStr = authHeader.slice(7).trim();
    }
  }

  // 2. Check cookies (onton_token, token, onton_session)
  if (!tokenStr) {
    try {
      const cookieStore = cookies();
      const ontonToken = cookieStore.get("onton_token");
      const legacyToken = cookieStore.get("token");
      const sessionToken = cookieStore.get("onton_session");

      tokenStr = ontonToken?.value || legacyToken?.value || sessionToken?.value;
    } catch {
      // cookies() may throw outside of request context
    }
  }

  if (!tokenStr) {
    return [null, Response.json({ error: "Unauthorized: No token provided" }, { status: 401 })];
  }

  // 3. AUTH_JWT_SECRET only, HS256 only (#1051). No ONTON_API_SECRET / BOT_TOKEN fallback.
  const userId = verifyPlatformJwtSync(tokenStr);
  if (userId !== null) {
    return [userId, null];
  }

  return [null, Response.json({ error: "Unauthorized: invalid token" }, { status: 401 })];
}

type LegacyJwtClaims = { userId?: unknown; id?: unknown };

/**
 * Synchronous platform JWT check for callers that cannot await. Returns the user id or null.
 */
function verifyPlatformJwtSync(token: string): number | null {
  try {
    const claims: unknown = verify(token, getAuthJwtSecret(), { algorithms: [PLATFORM_JWT_ALGORITHM] });
    if (typeof claims !== "object" || claims === null) return null;
    const { userId, id } = claims as LegacyJwtClaims;
    const resolved = userId ?? id;
    return typeof resolved === "number" && resolved > 0 ? resolved : null;
  } catch {
    return null;
  }
}

export async function walletFromHeader(headers: Headers): Promise<AuthToken> {
  const raw = headers.get("x-session-jwt");
  if (!raw) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "missing token" });

  const payload = await verifyToken(raw);
  if (!payload) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "bad token" });

  return payload as AuthToken;
}
