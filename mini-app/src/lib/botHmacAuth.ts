import crypto from "crypto";

/**
 * Constant-time comparison to prevent timing attacks.
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
 * Verifies that an incoming HTTP request originated from the Onton Telegram Bot
 * using HMAC-SHA256 signature verification over the body and timestamp.
 *
 * Pattern matches telegram-bot/src/middleware/hmacAuth.ts.
 */
export function verifyBotHmac(
  headers: Headers,
  rawBody: string
): { valid: boolean; error?: string } {
  const secret =
    process.env.BOT_API_HMAC_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { valid: false, error: "Bot API HMAC secret is not configured" };
    }
    return { valid: true };
  }

  // 1. Check for HMAC signature & timestamp headers
  const signature = headers.get("x-signature");
  const timestampStr = headers.get("x-timestamp");

  if (signature && timestampStr) {
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    // Replay attack window: 60 seconds
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 60000) {
      return { valid: false, error: "Request timestamp expired or invalid" };
    }

    const payload = `${timestampStr}.${rawBody || ""}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (safeEqual(signature, expectedSig)) {
      return { valid: true };
    }
  }

  // 2. Fallback: Check for valid x-api-key header (inter-service authentication)
  const apiKey = headers.get("x-api-key") || headers.get("authorization");
  const keyToTest = apiKey?.startsWith("Bearer ")
    ? apiKey.slice(7).trim()
    : apiKey?.trim();

  if (keyToTest) {
    const expectedKey = process.env.ONTON_API_SECRET || secret;
    if (safeEqual(keyToTest, expectedKey)) {
      return { valid: true };
    }
  }

  return { valid: false, error: "Invalid or missing authentication signature / API key" };
}
