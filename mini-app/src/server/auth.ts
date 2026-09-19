import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import { AuthToken, verifyToken } from "@/server/utils/jwt";

export { apiKeyAuthentication, safeTimingEqual } from "@/server/apiKeyAuth";

export function getAuthenticatedUser(): [number, null] | [null, Response] {
  const userToken = cookies().get("token");

  if (!userToken) {
    return [null, Response.json({ error: "Unauthorized: No token provided" }, { status: 401 })];
  }

  try {
    // validate user token
    const validation = verify(userToken.value, process.env.BOT_TOKEN as string);

    if (typeof validation === "string") {
      return [null, Response.json({ error: "Unauthorized: Validation failed" }, { status: 401 })];
    }

    return [validation.id as number, null];
  } catch {
    return [null, Response.json({ error: "Unauthorized: invalid token" }, { status: 401 })];
  }
}

export async function walletFromHeader(headers: Headers): Promise<AuthToken> {
  const raw = headers.get("x-session-jwt");
  if (!raw) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "missing token" });

  const payload = await verifyToken(raw);
  if (!payload) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "bad token" });

  return payload as AuthToken;
}
