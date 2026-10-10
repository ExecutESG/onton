import crypto from "crypto";
import { readRequiredSecret } from "@/server/utils/requiredSecrets";

export const getTelegramBotBaseUrl = (): string => {
  const host = process.env.IP_TELEGRAM_BOT || "telegram-bot";
  const port = process.env.TELEGRAM_BOT_PORT || "3002";
  return `http://${host}:${port}`;
};

export const getTelegramBotHeaders = (body?: any): Record<string, string> => {
  // BOT_API_HMAC_SECRET only (#1052). Throws instead of sending unsigned requests.
  const secret = readRequiredSecret("BOT_API_HMAC_SECRET");
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${typeof body === "object" ? JSON.stringify(body) : body || ""}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "x-api-key": secret,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };
};
