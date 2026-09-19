import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

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

  const secret =
    process.env.BOT_API_HMAC_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN;

  if (!secret) {
    // In production, refuse to process unauthenticated requests if no secret is configured
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({
        status: "error",
        message: "Bot API secret is not configured on the server",
      });
    }
    return next();
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
    const expectedKey = process.env.ONTON_API_SECRET || secret;
    if (safeEqual(keyToTest, expectedKey)) {
      return next();
    }
  }

  return res.status(401).json({
    status: "error",
    message: "Unauthorized: Invalid or missing authentication signature / API key",
  });
}
