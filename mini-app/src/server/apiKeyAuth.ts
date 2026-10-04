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
 * Validates x-api-key header against ONTON_API_SECRET using constant-time comparison.
 * Safe for Next.js Edge middleware and Node.js runtime.
 * @param req {Request}
 */
export function apiKeyAuthentication(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey)
    return Response.json(
      {
        error: "authentication_failed",
        message: "No x-api-key header found",
      },
      { status: 401 }
    );

  const secret = process.env.ONTON_API_SECRET;
  if (!secret || !safeTimingEqual(apiKey, secret))
    return Response.json(
      {
        error: "authentication_failed",
        message: "Invalid x-api-key header found",
      },
      { status: 401 }
    );

  return null;
}
