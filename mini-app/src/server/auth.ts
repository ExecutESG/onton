import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import { AuthToken, verifyToken, AUTH_JWT_SECRET } from "@/server/utils/jwt";

export { apiKeyAuthentication, safeTimingEqual } from "@/server/apiKeyAuth";

/**
 * Validates authenticated user from session cookies or optional request headers.
 * Supports modern omnichannel platform tokens, onton_session, and legacy bot-signed tokens.
 */
export function getAuthenticatedUser(req?: Request): [number, null] | [null, Response] {
  let tokenStr: string | undefined;

  // 1. Check Authorization: Bearer <token> if req is provided
  if (req) {
    const authHeader = req.headers.get("Authorization");
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

  // 3. Multi-secret validation fallback
  const secretsToTry = [
    process.env.AUTH_JWT_SECRET,
    AUTH_JWT_SECRET,
    process.env.ONTON_API_SECRET,
    process.env.BOT_TOKEN,
  ].filter(Boolean) as string[];

  for (const secret of secretsToTry) {
    try {
      const validation = verify(tokenStr, secret);
      if (typeof validation === "object" && validation) {
        const userId = (validation as any).userId || (validation as any).id;
        if (typeof userId === "number") {
          return [userId, null];
        }
      }
    } catch {
      // Continue to next secret
    }
  }

  return [null, Response.json({ error: "Unauthorized: invalid token" }, { status: 401 })];
}

export async function walletFromHeader(headers: Headers): Promise<AuthToken> {
  const raw = headers.get("x-session-jwt");
  if (!raw) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "missing token" });

  const payload = await verifyToken(raw);
  if (!payload) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "bad token" });

  return payload as AuthToken;
}
