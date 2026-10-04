import crypto from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Safe for Edge runtime and Node.js.
 */
export function safeTimingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates request authentication via HMAC signature or x-api-key header.
 * Supports BOT_API_HMAC_SECRET, ONTON_API_SECRET, and BOT_TOKEN.
 * @param req Request
 * @param bodyText Optional raw request body string for HMAC verification
 */
export function apiKeyAuthentication(req: Request, bodyText?: string) {
  // 1. Check HMAC signature if x-signature and x-timestamp are present
  const signature = req.headers.get("x-signature");
  const timestampStr = req.headers.get("x-timestamp");

  const apiKey =
    req.headers.get("x-api-key") ||
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")?.slice(7).trim()
      : null);

  if (!signature && !apiKey) {
    return Response.json(
      {
        error: "authentication_failed",
        message: "No x-api-key header found",
      },
      { status: 401 }
    );
  }

  const allowedSecrets = [
    process.env.ONTON_API_SECRET,
    process.env.BOT_API_HMAC_SECRET,
    process.env.BOT_TOKEN,
  ].filter(Boolean) as string[];

  if (allowedSecrets.length === 0) {
    return Response.json(
      {
        error: "authentication_failed",
        message: "Invalid x-api-key header found",
      },
      { status: 401 }
    );
  }

  if (signature && timestampStr) {
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    // 60-second replay window
    if (!isNaN(timestamp) && Math.abs(now - timestamp) <= 60000) {
      const payload = `${timestampStr}.${bodyText || ""}`;
      const isSignatureValid = allowedSecrets.some((secret) => {
        const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        return safeTimingEqual(signature, expectedSig);
      });
      if (isSignatureValid) {
        return null;
      }
    }
  }

  if (apiKey) {
    const isValid = allowedSecrets.some((secret) => safeTimingEqual(apiKey, secret));
    if (isValid) {
      return null;
    }
  }

  return Response.json(
    {
      error: "authentication_failed",
      message: "Invalid x-api-key header found",
    },
    { status: 401 }
  );
}


