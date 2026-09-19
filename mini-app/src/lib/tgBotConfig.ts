import crypto from "crypto";

export const getTelegramBotBaseUrl = (): string => {
  const host = process.env.IP_TELEGRAM_BOT || "telegram-bot";
  const port = process.env.TELEGRAM_BOT_PORT || "3002";
  return `http://${host}:${port}`;
};

export const getTelegramBotHeaders = (body?: any): Record<string, string> => {
  const secret =
    process.env.BOT_API_HMAC_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN ||
    "";
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${typeof body === "object" ? JSON.stringify(body) : body || ""}`;
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(payload).digest("hex")
    : "";

  return {
    "x-api-key": secret,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };
};
