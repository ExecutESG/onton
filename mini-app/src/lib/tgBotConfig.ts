export const getTelegramBotBaseUrl = (): string => {
  const host = process.env.IP_TELEGRAM_BOT || "telegram-bot";
  const port = process.env.TELEGRAM_BOT_PORT || "3002";
  return `http://${host}:${port}`;
};
