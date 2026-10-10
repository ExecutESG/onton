import { createHash } from "crypto";

/**
 * Secrets the telegram-bot process uses (#1052). Mirrors mini-app/src/server/utils/requiredSecrets.ts;
 * keep the two lists of known defaults in sync.
 * - BOT_API_HMAC_SECRET: HMAC between mini-app and bot (both directions).
 * - ONTON_API_SECRET: signs upload JWTs sent to the mini-app upload routes.
 * AUTH_JWT_SECRET and TOTP_SECRET are not used by the bot, so it does not require them.
 */
export const BOT_REQUIRED_SECRET_KEYS = ["BOT_API_HMAC_SECRET", "ONTON_API_SECRET"] as const;

export type BotRequiredSecretKey = (typeof BOT_REQUIRED_SECRET_KEYS)[number];

export const MIN_SECRET_LENGTH = 32;

/** SHA-256 of public placeholder / old fallback values. Add leaked defaults by hash, never by value. */
export const KNOWN_DEFAULT_SECRET_SHA256: ReadonlySet<string> = new Set([
  "9a805db82e9c60ceb75205834b3bf06cbf647dfcd0c4a6cd4690761314dfb4fc", // .env.example ONTON_API_SECRET placeholder
  "76290373e6783fbdadfb93c94c0c515fb6199c09765c834991138ca77abb6852", // BOT_API_HMAC_SECRET leaked in git history (commit 78f1cf263d)
  "68b9f3fb47212d934194cdc4c285b3bcc559d0346267ec58d8a0fe7e015a29fb", // .env.example CLIENT_API_JWT_SECRET placeholder
  "f21f48a15f762f5b5f2ed38a4eb64776bcef72f9162a95b1be343f9cf74b2baf", // .env.example JWT_SECRET_SOCKET placeholder
  "9a6e234a5c4eb20c4939476c7dea9d6a08a6c64bc04ac74c3e256f6ae2b360e9", // removed mini-app jwt.ts hardcoded fallback
  "d265212424834aeb10e1978c67675eff53f419253c5c4376627a976907bf887b", // removed mini-app passToken.ts hardcoded salt
  "a288df15c5fcbca80827fb045b9fddabbd850683d560b8e472d83944f70fca3a", // removed upload "fallback-secret"
  "d0866dd206cdee8fbcf414faab9e9dbd28deb2f2f4506e8714db276c86bc97b6", // ONTON_API_SECRET leaked in git history (commits edccb194dc, 4aef3d1fc6)
  "cdad32cbf482244763dfcb64c5d29436e5d412b3211baaeadfdef373f019d1b1", // ONTON_API_SECRET leaked in git history (commit 95dc9fe158)
  "0599753f982fb85fbf96c3e92e4e42ea4fba20f5d9063d3dae3f3fe9ae5716fa", // ONTON_API_SECRET leaked in git history (commit 4aef3d1fc6)
  "5ef0f7fc95bf04ad2c7c1310e1e4299cf1c2724f15f09fbfc5a0fe99279dd959", // JWT_SECRET leaked in git history (commits 772a3c13e3, edccb194dc)
  "d1bec331070806a33393d3f542faf27a7e8f184c67fe42be514f7815244f74fe", // JWT_SECRET leaked in git history (commit 4aef3d1fc6)
  "29bc85b1c6f2150d971603f712579c60ed9539f3d493ff8902ba8675aad438e4", // CLIENT_API_JWT_SECRET leaked in git history (commit 679474877c)
]);

const PLACEHOLDER_PATTERN = /^your[_-]|_here$|change[_-]?me|placeholder|default|example|fallback/i;

/** Returns a problem description naming the key only, or null when acceptable. */
export function describeSecretProblem(key: string, value: string | undefined): string | null {
  if (!value || value.trim() === "") return `${key} is not set`;
  if (value.length < MIN_SECRET_LENGTH) return `${key} is shorter than ${MIN_SECRET_LENGTH} characters`;
  const hash = createHash("sha256").update(value).digest("hex");
  if (PLACEHOLDER_PATTERN.test(value) || KNOWN_DEFAULT_SECRET_SHA256.has(hash)) {
    return `${key} equals a known default/example value`;
  }
  return null;
}

/** Reads one required secret; throws (naming the key only) if missing, short or a known default. */
export function readRequiredSecret(key: BotRequiredSecretKey, env: Record<string, string | undefined> = process.env): string {
  const value = env[key];
  const problem = describeSecretProblem(key, value);
  if (problem) throw new Error(`Required secret problem: ${problem}`);
  return value as string;
}

/**
 * Fail-fast boot check for the bot. Throws naming every bad key; never includes values.
 * Also rejects BOT_API_HMAC_SECRET === ONTON_API_SECRET and reuse of BOT_TOKEN.
 */
export function assertRequiredSecrets(env: Record<string, string | undefined> = process.env): void {
  const problems: string[] = [];
  for (const key of BOT_REQUIRED_SECRET_KEYS) {
    const problem = describeSecretProblem(key, env[key]);
    if (problem) {
      problems.push(problem);
    } else if (env.BOT_TOKEN && env[key] === env.BOT_TOKEN) {
      problems.push(`${key} reuses the value of BOT_TOKEN`);
    }
  }
  if (env.BOT_API_HMAC_SECRET && env.BOT_API_HMAC_SECRET === env.ONTON_API_SECRET) {
    problems.push("BOT_API_HMAC_SECRET reuses the value of ONTON_API_SECRET");
  }
  if (problems.length > 0) {
    throw new Error(
      `Required secrets are missing or weak: ${problems.join("; ")}. Generate each with: openssl rand -hex 32`,
    );
  }
}
