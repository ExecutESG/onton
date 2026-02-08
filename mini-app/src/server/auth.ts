import { db } from "@/db/db";
import { user_custom_flags } from "@/db/schema/user_custom_flags";
import { and, eq } from "drizzle-orm";
import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import { AuthToken, verifyToken } from "@/server/utils/jwt";
import type { FastifyRequest } from "fastify";
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
  } catch (err) {
    return [null, Response.json({ error: "Unauthorized: invalid token" }, { status: 401 })];
  }
}

/**
 * By using this function in routes.
 * that route need to have an 'x-api-key' header to be accessed
 * @param req {Request}
 */
export function apiKeyAuthentication(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey)
    return Response.json(
      {
        error: "authentication_failed",
        message: "No x-api-key header found",
      },
      { status: 401 }
    );

  if (apiKey !== process.env.ONTON_API_SECRET)
    return Response.json(
      {
        error: "authentication_failed",
        message: "Invalid x-api-key header found",
      },
      { status: 401 }
    );

  return null;
}

export async function getAuthenticatedUserApi(req: Request): Promise<[number, null] | [null, Response]> {
  const apiKey = req.headers.get("api_key") || req.headers.get("Authorization");

  if (!apiKey) {
    return [null, Response.json({ error: "Unauthorized: No Api Key provided" }, { status: 401 })];
  }

  try {
    const result = await db.query.user_custom_flags.findFirst({
      where: and(
        eq(user_custom_flags.user_flag, "api_key"),
        eq(user_custom_flags.value, apiKey),
        eq(user_custom_flags.enabled, true)
      ),
    });
    if (!result) return [null, Response.json({ error: "Unauthorized: invalid Api Key" }, { status: 401 })];

    if (!result.user_id) return [null, Response.json({ error: "Unauthorized: Dangling Api Key" }, { status: 401 })];

    return [result.user_id, null];
  } catch (err) {
    return [null, Response.json({ error: "Something went wrong" }, { status: 500 })];
  }
}
export async function walletFromHeader(headers: Headers): Promise<AuthToken> {
  const raw = headers.get("x-session-jwt");
  if (!raw) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "missing token" });

  const payload = await verifyToken(raw);
  if (!payload) throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "bad token" });

  return payload as AuthToken;
}
