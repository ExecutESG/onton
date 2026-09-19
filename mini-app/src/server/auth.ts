import { db } from "@/db/db";
import { user_custom_flags } from "@/db/schema/user_custom_flags";
import { and, eq } from "drizzle-orm";
import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import { AuthToken, verifyToken } from "@/server/utils/jwt";
import crypto from "crypto";
import { comparePassword, hashPassword } from "@/lib/bcrypt";

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

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform dummy timing check to prevent early termination leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
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

  const secret = process.env.ONTON_API_SECRET;
  if (!secret || !safeTimingEqual(apiKey, secret))
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
  const rawKey = req.headers.get("api_key") || req.headers.get("Authorization");

  if (!rawKey) {
    return [null, Response.json({ error: "Unauthorized: No Api Key provided" }, { status: 401 })];
  }

  // Strip optional 'Bearer ' prefix if present
  const apiKey = rawKey.startsWith("Bearer ") ? rawKey.slice(7).trim() : rawKey.trim();

  try {
    const allActiveKeys = await db.query.user_custom_flags.findMany({
      where: and(
        eq(user_custom_flags.user_flag, "api_key"),
        eq(user_custom_flags.enabled, true)
      ),
    });

    for (const record of allActiveKeys) {
      if (!record.value) continue;

      let isMatch = false;
      // Check if stored value is a bcrypt hash ($2a$ or $2b$)
      if (record.value.startsWith("$2a$") || record.value.startsWith("$2b$")) {
        isMatch = await comparePassword(apiKey, record.value);
      } else {
        // Constant-time comparison for legacy plaintext key
        if (safeTimingEqual(apiKey, record.value)) {
          isMatch = true;
          // Asynchronously migrate plaintext key to bcrypt hash
          hashPassword(apiKey)
            .then((hashed) =>
              db
                .update(user_custom_flags)
                .set({ value: hashed })
                .where(eq(user_custom_flags.id, record.id))
            )
            .catch(() => {});
        }
      }

      if (isMatch) {
        if (!record.user_id) {
          return [null, Response.json({ error: "Unauthorized: Dangling Api Key" }, { status: 401 })];
        }
        return [record.user_id, null];
      }
    }

    return [null, Response.json({ error: "Unauthorized: invalid Api Key" }, { status: 401 })];
  } catch {
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
