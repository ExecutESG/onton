/**
 * Side-effect import for standalone worker entry points (#1052).
 * Import it right after `dotenv/config` so the check sees the loaded env.
 * Exits the process when a required secret is missing, short or a known default.
 */
import { assertRequiredSecrets } from "@/server/utils/requiredSecrets";

try {
  assertRequiredSecrets();
} catch (err) {
  // The message names keys only, never values.
  console.error(`[startup] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
