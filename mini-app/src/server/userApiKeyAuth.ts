import { db } from "@/db/db";
import { user_custom_flags } from "@/db/schema/user_custom_flags";
import { and, eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "@/lib/bcrypt";
import { safeTimingEqual } from "@/server/apiKeyAuth";

/**
 * Authenticates user API key against user_custom_flags table.
 * Supports both bcrypt hashed keys and legacy plaintext keys with auto-migration.
 * Uses constant-time comparison to prevent timing attacks.
 */
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
