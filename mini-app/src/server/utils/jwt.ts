import { CHAIN } from "@/constants";
import { ValueOf } from "@/types";
import { decodeJwt, JWTPayload, jwtVerify, SignJWT } from "jose";
import { readRequiredSecret } from "@/server/utils/requiredSecrets";

/** Only algorithm accepted for platform JWTs. Pinned to block alg-confusion. */
export const PLATFORM_JWT_ALGORITHM = "HS256";

/**
 * Platform JWT secret. AUTH_JWT_SECRET only: no ONTON_API_SECRET / BOT_TOKEN / hardcoded fallback (#1051).
 * Read lazily so `next build` and module imports do not need the secret; throws when it is missing or weak.
 */
export function getAuthJwtSecret(): string {
  return readRequiredSecret("AUTH_JWT_SECRET");
}

function getAuthJwtKey(): Uint8Array {
  return new TextEncoder().encode(getAuthJwtSecret());
}

/**
 * Payload of wallet session token.
 */
export type AuthToken = {
  address: string;
  network: ValueOf<typeof CHAIN>;
};

export type PayloadToken = {
  address: string;
};

export type WebSessionToken = {
  userId: number;
  authMethod: "telegram_widget" | "google" | "ton_connect" | "email" | "telegram";
};

export type PlatformProvider = "telegram" | "google" | "email" | "ton_wallet" | "discord" | "apple" | "api_key";

/**
 * Standardized Omnichannel Platform Authentication Payload.
 */
export type PlatformAuthPayload = {
  userId: number;
  userUuid?: string;
  provider: PlatformProvider;
  email?: string;
  telegramId?: number;
  role?: string;
};

const PLATFORM_PROVIDERS: ReadonlySet<string> = new Set<PlatformProvider>([
  "telegram",
  "google",
  "email",
  "ton_wallet",
  "discord",
  "apple",
  "api_key",
]);

/** Maps `provider` (platform tokens) or `authMethod` (web session tokens) to a PlatformProvider. */
function resolveProvider(payload: JWTPayload): PlatformProvider {
  const raw = payload.provider ?? payload.authMethod;
  if (raw === "telegram_widget") return "telegram";
  if (raw === "ton_connect") return "ton_wallet";
  if (typeof raw === "string" && PLATFORM_PROVIDERS.has(raw)) return raw as PlatformProvider;
  return "telegram";
}

/**
 * Create a token with the given payload.
 */
function buildCreateToken<T extends JWTPayload>(expirationTime: string): (payload: T) => Promise<string> {
  return async (payload: T) => {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: PLATFORM_JWT_ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(getAuthJwtKey());
  };
}

export const createAuthToken = buildCreateToken<AuthToken>("2w");
export const createPayloadToken = buildCreateToken<PayloadToken>("2w");
export const createWebSessionToken = buildCreateToken<WebSessionToken>("7d");

/**
 * Issue a signed Platform JWT token for any authenticated user/provider.
 */
export async function createPlatformToken(payload: PlatformAuthPayload, expiration = "7d"): Promise<string> {
  return new SignJWT({
    ...payload,
    id: payload.userId, // legacy compatibility
  })
    .setProtectedHeader({ alg: PLATFORM_JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(getAuthJwtKey());
}

/**
 * Verify a token signed with AUTH_JWT_SECRET (HS256 only). Returns null for any other key or algorithm.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthJwtKey(), { algorithms: [PLATFORM_JWT_ALGORITHM] });
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a platform/web session token and normalize it. AUTH_JWT_SECRET only, HS256 only.
 * Tokens signed with ONTON_API_SECRET, BOT_TOKEN or the old hardcoded key are rejected (#1051).
 */
export async function verifyPlatformToken(token: string): Promise<PlatformAuthPayload | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const rawUserId = payload.userId ?? payload.id;
  if (typeof rawUserId !== "number" || !Number.isFinite(rawUserId) || rawUserId <= 0) return null;

  return {
    userId: rawUserId,
    userUuid: typeof payload.userUuid === "string" ? payload.userUuid : undefined,
    provider: resolveProvider(payload),
    email: typeof payload.email === "string" ? payload.email : undefined,
    telegramId: typeof payload.telegramId === "number" ? payload.telegramId : undefined,
    role: typeof payload.role === "string" ? payload.role : "user",
  };
}

/**
 * Decode the given token.
 */
function buildDecodeToken<T extends JWTPayload>(): (token: string) => T | null {
  return (token: string) => {
    try {
      return decodeJwt(token) as T;
    } catch (e) {
      return null;
    }
  };
}

export const decodeAuthToken = buildDecodeToken<AuthToken>();
export const decodePayloadToken = buildDecodeToken<PayloadToken>();
