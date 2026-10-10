import { createHmac, timingSafeEqual } from "crypto";
import { describeSecretProblem } from "@/server/utils/requiredSecrets";

/**
 * Verifies bot -> mini-app requests. BOT_API_HMAC_SECRET only (#1052): no ONTON_API_SECRET / BOT_TOKEN fallback.
 */
export async function verifyBotHmac(req: Request): Promise<Response | null> {
  const secret = process.env.BOT_API_HMAC_SECRET;
  if (!secret || describeSecretProblem("BOT_API_HMAC_SECRET", secret)) {
    return Response.json({ error: "Configuration error", message: "BOT_API_HMAC_SECRET is not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-signature");
  const timestampHeader = req.headers.get("x-timestamp");

  if (!signature || !timestampHeader) {
    return Response.json({ error: "authentication_failed", message: "Missing signature or timestamp header" }, { status: 401 });
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 60_000) {
    return Response.json({ error: "authentication_failed", message: "Signature expired or invalid timestamp" }, { status: 401 });
  }

  const reqClone = req.clone();
  const rawBody = await reqClone.text();
  const url = new URL(req.url);

  // Canonical string: `${ts}.${method}.${pathname}.${rawBody}`
  const canonicalString = `${timestampHeader}.${req.method}.${url.pathname}.${rawBody}`;

  const expectedSignature = createHmac("sha256", secret).update(canonicalString).digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return Response.json({ error: "authentication_failed", message: "Invalid signature" }, { status: 401 });
  }

  return null;
}
