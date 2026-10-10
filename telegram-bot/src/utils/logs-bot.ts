import { Bot } from "grammy";
import { configProtected } from "./onton-config";
import { logger } from "./logger";

let logsBot: undefined | Bot;

const DEFAULT_LOGS_GROUP_ID = "-1002264975789";

const logs_topics = [
  "events_topic",
  "general",
  "tickets_topic",
  "organizers_topic",
  "system_topic",
] as const;

const TOPIC_DEFAULTS: Record<(typeof logs_topics)[number], number> = {
  events_topic: 2,
  general: 1,
  tickets_topic: 4,
  organizers_topic: 214,
  system_topic: 12,
};

const getLogsBot = (): Bot | null => {
  if (logsBot) return logsBot;

  const token =
    configProtected?.["bot_token_logs"] ||
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN;

  if (token && !token.startsWith("$") && !token.includes("${")) {
    logsBot = new Bot(token);
    return logsBot;
  }

  return null;
};

export const sendTopicMessage = async (
  topic: (typeof logs_topics)[number],
  text: string,
) => {
  try {
    const activeBot = getLogsBot();
    if (!activeBot) {
      logger.warn("telegram bot sendTopicMessage skipped: no valid bot token configured");
      return;
    }

    const configuredGroupId =
      configProtected?.["logs_group_id"] ||
      process.env.LOGS_GROUP_ID;

    if (!configuredGroupId) {
      logger.warn("telegram bot sendTopicMessage skipped: LOGS_GROUP_ID is unset in environment (non-prod safety)");
      return;
    }

    const groupId = Number(configuredGroupId);

    const replyTopicId = Number(
      configProtected?.[topic] || TOPIC_DEFAULTS[topic]
    );

    // Topic 1 is General in Telegram forums; messages without thread ID route to General
    const options = replyTopicId && replyTopicId !== 1
      ? { reply_to_message_id: replyTopicId }
      : undefined;

    await activeBot.api.sendMessage(groupId, text, options);
  } catch (error) {
    logger.error("telegram bot sendTopicMessage error:", error);
  }
};

