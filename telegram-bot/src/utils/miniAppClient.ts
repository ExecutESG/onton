import crypto from "crypto";

/**
 * Returns the base URL for reaching the mini-app HTTP server.
 * Prioritizes internal docker network host, then public app base URL, then localhost.
 */
export const getMiniAppBaseUrl = (): string => {
  if (process.env.INTERNAL_MINI_APP_URL) {
    return process.env.INTERNAL_MINI_APP_URL.replace(/\/$/, "");
  }
  if (process.env.IP_MINI_APP) {
    const port = process.env.MINI_APP_PORT || "3000";
    return `http://${process.env.IP_MINI_APP}:${port}`;
  }
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL;
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/$/, "");
  }
  return "http://localhost:3000";
};

/**
 * Generates HMAC signature headers for secure bot-to-mini-app communications.
 * Pattern matches mini-app/src/lib/tgBotConfig.ts and telegram-bot/src/middleware/hmacAuth.ts.
 */
export const getMiniAppHmacHeaders = (body?: unknown): Record<string, string> => {
  const secret =
    process.env.BOT_API_HMAC_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN ||
    "";
  const timestamp = Date.now().toString();
  const rawBody = typeof body === "object" ? JSON.stringify(body) : String(body || "");
  const payload = `${timestamp}.${rawBody}`;
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(payload).digest("hex")
    : "";

  return {
    "Content-Type": "application/json",
    "x-api-key": secret,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };
};
