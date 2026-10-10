import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { describeSecretProblem } from "../utils/requiredSecrets";

/**
 * Constant-time comparison to prevent timing attacks
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * HMAC & API Key Authentication Middleware for Telegram Bot Express API
 * Resolves Issue #940: Protect bot Express routes against unauthorized access
 */
export function hmacAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Allow healthcheck without authentication
  if (req.path === "/health") {
    return next();
  }

  // BOT_API_HMAC_SECRET only (#1052). No ONTON_API_SECRET / BOT_TOKEN fallback and no
  // unauthenticated pass-through when it is unset: fail closed in every environment.
  const secret = process.env.BOT_API_HMAC_SECRET;

  if (!secret || describeSecretProblem("BOT_API_HMAC_SECRET", secret)) {
    return res.status(500).json({
      status: "error",
      message: "Bot API secret is not configured on the server",
    });
  }

  // 1. Check for HMAC signature & timestamp headers
  const signature = req.headers["x-signature"] as string | undefined;
  const timestampStr = req.headers["x-timestamp"] as string | undefined;

  if (signature && timestampStr) {
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    // Replay attack window: 60 seconds
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 60000) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Request timestamp expired or invalid",
      });
    }

    const payload = `${timestampStr}.${typeof req.body === "object" ? JSON.stringify(req.body) : req.body || ""}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (safeEqual(signature, expectedSig)) {
      return next();
    }
  }

  // 2. Fallback: Check for valid x-api-key header (inter-service authentication)
  const apiKey = (req.headers["x-api-key"] || req.headers["authorization"]) as
    | string
    | undefined;

  const keyToTest = apiKey?.startsWith("Bearer ")
    ? apiKey.slice(7).trim()
    : apiKey?.trim();

  if (keyToTest) {
    // The mini-app sends BOT_API_HMAC_SECRET as x-api-key for multipart uploads it cannot sign
    // (see mini-app/src/lib/tgBotConfig.ts). ONTON_API_SECRET is no longer accepted here.
    if (safeEqual(keyToTest, secret)) {
      return next();
    }
  }

  return res.status(401).json({
    status: "error",
    message: "Unauthorized: Invalid or missing authentication signature / API key",
  });
}
