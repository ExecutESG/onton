import { CHAIN, SHARED_SECRET } from "@/constants";
import { ValueOf } from "@/types";
import { decodeJwt, JWTPayload, jwtVerify, SignJWT } from "jose";
import { verify as verifyJwtLegacy } from "jsonwebtoken";

/**
 * Dedicated platform JWT secret key with dynamic fallbacks for legacy tokens.
 */
export function getAuthJwtSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN ||
    "onton-platform-default-secret-key-32chars"
  );
}

export const AUTH_JWT_SECRET = getAuthJwtSecret();

const JWT_SECRET_KEY = SHARED_SECRET || AUTH_JWT_SECRET;

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

/**
 * Standardized Omnichannel Platform Authentication Payload.
 */
export type PlatformAuthPayload = {
  userId: number;
  userUuid?: string;
  provider: "telegram" | "google" | "email" | "ton_wallet" | "discord" | "apple" | "api_key";
  email?: string;
  telegramId?: number;
  role?: string;
};

/**
 * Create a token with the given payload.
 */
function buildCreateToken<T extends JWTPayload>(expirationTime: string): (payload: T) => Promise<string> {
  return async (payload: T) => {
    const encoder = new TextEncoder();
    const key = encoder.encode(JWT_SECRET_KEY);
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(key);
  };
}

export const createAuthToken = buildCreateToken<AuthToken>("2w");
export const createPayloadToken = buildCreateToken<PayloadToken>("2w");
export const createWebSessionToken = buildCreateToken<WebSessionToken>("7d");

/**
 * Issue a signed Platform JWT token for any authenticated user/provider.
 */
export async function createPlatformToken(
  payload: PlatformAuthPayload,
  expiration = "7d"
): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(getAuthJwtSecret());
  return new SignJWT({
    ...payload,
    id: payload.userId, // legacy compatibility
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(key);
}

/**
 * Verify given token using multi-secret fallback (AUTH_JWT_SECRET -> SHARED_SECRET -> BOT_TOKEN).
 */
export async function verifyPlatformToken(token: string): Promise<PlatformAuthPayload | null> {
  const encoder = new TextEncoder();

  // 1. Try AUTH_JWT_SECRET via jose
  try {
    const key = encoder.encode(getAuthJwtSecret());
    const { payload } = await jwtVerify(token, key);
    const userId = (payload.userId as number) || (payload.id as number);
    if (userId) {
      return {
        userId,
        userUuid: payload.userUuid as string | undefined,
        provider: (payload.provider as any) || "telegram",
        email: payload.email as string | undefined,
        telegramId: payload.telegramId as number | undefined,
        role: (payload.role as string) || "user",
      };
    }
  } catch {}

  // 2. Try SHARED_SECRET if different from AUTH_JWT_SECRET
  if (SHARED_SECRET && SHARED_SECRET !== AUTH_JWT_SECRET) {
    try {
      const key = encoder.encode(SHARED_SECRET);
      const { payload } = await jwtVerify(token, key);
      const userId = (payload.userId as number) || (payload.id as number);
      if (userId) {
        return {
          userId,
          userUuid: payload.userUuid as string | undefined,
          provider: (payload.authMethod as any) || (payload.provider as any) || "telegram",
          email: payload.email as string | undefined,
          telegramId: payload.telegramId as number | undefined,
          role: (payload.role as string) || "user",
        };
      }
    } catch {}
  }

  // 3. Try legacy jsonwebtoken validation with BOT_TOKEN
  const botToken = process.env.BOT_TOKEN;
  if (botToken) {
    try {
      const validation = verifyJwtLegacy(token, botToken);
      if (typeof validation === "object" && validation && (validation.id || (validation as any).userId)) {
        const userId = ((validation as any).userId || validation.id) as number;
        return {
          userId,
          provider: "telegram",
          role: (validation as any).role || "user",
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Verify the given token (backward-compatible wrapper).
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const encoder = new TextEncoder();
  const key = encoder.encode(JWT_SECRET_KEY);
  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    // Fallback to platform token verification
    const platform = await verifyPlatformToken(token);
    if (platform) {
      return {
        userId: platform.userId,
        id: platform.userId,
        provider: platform.provider,
      } as JWTPayload;
    }
    return null;
  }
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
