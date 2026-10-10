import { createHash } from "crypto";

/**
 * Secrets every mini-app process (Next server, workers, socket) needs.
 * Each one guards a different trust boundary, so they must be set, strong and distinct:
 * - AUTH_JWT_SECRET: signs/verifies platform session JWTs.
 * - TOTP_SECRET: signs rotating check-in pass tokens.
 * - ONTON_API_SECRET: x-api-key for server-to-server routes and upload JWTs.
 * - BOT_API_HMAC_SECRET: HMAC between mini-app and telegram-bot.
 */
export const REQUIRED_SECRET_KEYS = ["AUTH_JWT_SECRET", "TOTP_SECRET", "ONTON_API_SECRET", "BOT_API_HMAC_SECRET"] as const;

export type RequiredSecretKey = (typeof REQUIRED_SECRET_KEYS)[number];

export const MIN_SECRET_LENGTH = 32;

/**
 * SHA-256 hashes of values that are public (placeholders in `.env.example`, old hardcoded fallbacks).
 * Stored as hashes so a leaked real default (e.g. the old dev ONTON_API_SECRET) can be added
 * without writing it into the repo: `printf %s "$VALUE" | shasum -a 256`.
 */
export const KNOWN_DEFAULT_SECRET_SHA256: ReadonlySet<string> = new Set([
  "9a805db82e9c60ceb75205834b3bf06cbf647dfcd0c4a6cd4690761314dfb4fc", // .env.example ONTON_API_SECRET placeholder
  "76290373e6783fbdadfb93c94c0c515fb6199c09765c834991138ca77abb6852", // BOT_API_HMAC_SECRET leaked in git history (commit 78f1cf263d)
  "68b9f3fb47212d934194cdc4c285b3bcc559d0346267ec58d8a0fe7e015a29fb", // .env.example CLIENT_API_JWT_SECRET placeholder
  "f21f48a15f762f5b5f2ed38a4eb64776bcef72f9162a95b1be343f9cf74b2baf", // .env.example JWT_SECRET_SOCKET placeholder
  "9a6e234a5c4eb20c4939476c7dea9d6a08a6c64bc04ac74c3e256f6ae2b360e9", // removed jwt.ts hardcoded fallback
  "d265212424834aeb10e1978c67675eff53f419253c5c4376627a976907bf887b", // removed passToken.ts hardcoded salt
  "a288df15c5fcbca80827fb045b9fddabbd850683d560b8e472d83944f70fca3a", // removed upload "fallback-secret"
  "d0866dd206cdee8fbcf414faab9e9dbd28deb2f2f4506e8714db276c86bc97b6", // ONTON_API_SECRET leaked in git history (commits edccb194dc, 4aef3d1fc6)
  "cdad32cbf482244763dfcb64c5d29436e5d412b3211baaeadfdef373f019d1b1", // ONTON_API_SECRET leaked in git history (commit 95dc9fe158)
  "0599753f982fb85fbf96c3e92e4e42ea4fba20f5d9063d3dae3f3fe9ae5716fa", // ONTON_API_SECRET leaked in git history (commit 4aef3d1fc6)
  "5ef0f7fc95bf04ad2c7c1310e1e4299cf1c2724f15f09fbfc5a0fe99279dd959", // JWT_SECRET leaked in git history (commits 772a3c13e3, edccb194dc)
  "d1bec331070806a33393d3f542faf27a7e8f184c67fe42be514f7815244f74fe", // JWT_SECRET leaked in git history (commit 4aef3d1fc6)
  "29bc85b1c6f2150d971603f712579c60ed9539f3d493ff8902ba8675aad438e4", // CLIENT_API_JWT_SECRET leaked in git history (commit 679474877c)
]);

/** Placeholder-looking values (e.g. `your_x_here`, `changeme`) are rejected even if long enough. */
const PLACEHOLDER_PATTERN = /^your[_-]|_here$|change[_-]?me|placeholder|default|example|fallback/i;

export class MissingSecretError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Required secrets are missing or weak: ${problems.join("; ")}. Generate each with: openssl rand -hex 32`);
    this.name = "MissingSecretError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Returns a problem description for one key, or null when the value is acceptable.
 * The description names the key only, never the value.
 */
export function describeSecretProblem(key: string, value: string | undefined): string | null {
  if (!value || value.trim() === "") return `${key} is not set`;
  if (value.length < MIN_SECRET_LENGTH) return `${key} is shorter than ${MIN_SECRET_LENGTH} characters`;
  if (PLACEHOLDER_PATTERN.test(value) || KNOWN_DEFAULT_SECRET_SHA256.has(sha256(value))) {
    return `${key} equals a known default/example value`;
  }
  return null;
}

/**
 * Reads one required secret and throws if it is missing, short or a known default.
 * Use this at the point of use instead of `process.env.X || fallback`.
 */
export function readRequiredSecret(key: RequiredSecretKey, env: Record<string, string | undefined> = process.env): string {
  const value = env[key];
  const problem = describeSecretProblem(key, value);
  if (problem) throw new MissingSecretError([problem]);
  return value as string;
}

/**
 * Fail-fast boot check. Throws MissingSecretError naming every bad key.
 * Also rejects reuse of one value across keys and reuse of BOT_TOKEN.
 */
export function assertRequiredSecrets(env: Record<string, string | undefined> = process.env): void {
  const problems: string[] = [];
  const seen = new Map<string, RequiredSecretKey>();

  for (const key of REQUIRED_SECRET_KEYS) {
    const value = env[key];
    const problem = describeSecretProblem(key, value);
    if (problem) {
      problems.push(problem);
      continue;
    }
    const firstKey = seen.get(value as string);
    if (firstKey) {
      problems.push(`${key} reuses the value of ${firstKey}`);
    } else {
      seen.set(value as string, key);
    }
    if (env.BOT_TOKEN && value === env.BOT_TOKEN) {
      problems.push(`${key} reuses the value of BOT_TOKEN`);
    }
  }

  if (problems.length > 0) throw new MissingSecretError(problems);
}
