import { TG_SUPPORT_GROUP } from "@/constants";
import { EventRow } from "@/db/schema/events";
import { removeKey, removeSecretKey } from "@/lib/utils";
import { getNoticeEmoji } from "@/moderationBot/helpers";
import { configProtected } from "@/server/config";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { logger } from "@/server/utils/logger";
import axios, { AxiosError } from "axios";
import { Bot, InputFile } from "grammy";
import { InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo } from "grammy/types";

interface MediaGroupItem {
  type: "photo" | "video";
  url: string;
}

const tgClient = axios.create({
  baseURL: `http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}`,
});

// Helper to post to your custom Telegram server
const tgClientPost = (path: string, data: any) =>
  tgClient.post(`http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}/${path}`, data);

let botInstance: Bot | null = null;
const MAX_WAIT_TIME = 30000; // 30 seconds max wait time
const CHECK_INTERVAL = 100; // Check every 100ms

// Helper function to get or create the bot instance
export async function getEventsChannelBotInstance() {
  // If the bot is already created, return it
  if (botInstance) return botInstance;

  // Wait for the token to be available
  const startTime = Date.now();
  while (!configProtected.onton_events_publisher_bot) {
    if (Date.now() - startTime > MAX_WAIT_TIME) {
      throw new Error("Timed out waiting for bot token to be available.");
    }
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  // Once the token is available, create the bot instance
  botInstance = new Bot(configProtected.onton_events_publisher_bot);
  return botInstance;
}

// =========== Send Telegram Message ===========
export const sendTelegramMessage = async (props: {
  chat_id: string | number;
  message: string;
  link?: string;
  linkText?: string;
}) => {
  try {
    const response = await tgClientPost("send-message", {
      chat_id: props.chat_id,
      custom_message: props.message,
      link: props.link,
      linkText: props?.linkText || "Claim Reward",
    });

    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || "Message sent successfully",
      };
    }

    const errorMessage = `Error sending message sendTelegramMessage:${response.data.error || "An unknown error occurred"}`;
    logger.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
      status: response.status || 500,
    };
  } catch (error: unknown) {
    if (error instanceof AxiosError && error.response && error.response.data) {
      const errorMessage = `Error sending message sendTelegramMessage:${
        error.response.data.error || "Unknown error from server"
      }`;
      logger.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
        status: error.response?.status || 500,
      };
    }

    const errorMessage = `Error sending message sendTelegramMessage:${
      (error as Error).message || "An unexpected error occurred"
    }`;
    logger.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
      status: 500,
    };
  }
};

// =========== Send Event Photo ===========
export const sendEventPhoto = async (props: { event_id: string; user_id: string | number; message: string }) => {
  try {
    const response = await tgClientPost("send-photo", {
      id: props.event_id,
      user_id: String(props.user_id),
      message: props.message,
    });

    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || "Message sent successfully",
      };
    }

    const errorMessage = `Error sending message sendTelegramMessage:${response.data.error || "An unknown error occurred"}`;
    logger.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
      status: response.status || 500,
    };
  } catch (error: unknown) {
    if (error instanceof AxiosError && error.response && error.response.data) {
      const errorMessage = `Error sending message sendTelegramMessage:${
        error.response.data.error || "Unknown error from server"
      }`;
      logger.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
        status: error.response?.status || 500,
      };
    }

    const errorMessage = `Error sending message sendTelegramMessage:${
      (error as Error).message || "An unexpected error occurred"
    }`;
    logger.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
      status: 500,
    };
  }
};

// 🌳 ---- SEND LOG NOTIFICATION ---- 🌳
export const sendLogNotification = async (
  props: {
    message: string;
    topic: "event" | "ticket" | "system" | "payments" | "campaign" | "no_topic";
    image?: string | null;
    inline_keyboard?: InlineKeyboardMarkup;
    group_id?: number | string | null;
    reply_to_message_id?: number | null; // <---   optional param
    /**
     * If set, we'll send multiple photos/videos as a separate message (media group).
     * Then we'll send the "main" message below (possibly with an inline keyboard).
     */
    media_group?: MediaGroupItem[];
  } = {
    message: "",
    topic: "event",
    image: undefined,
    inline_keyboard: undefined,
    group_id: undefined,
    reply_to_message_id: undefined,
    media_group: undefined,
  }
) => {
  // 1) Validate config
  if (!configProtected?.bot_token_logs || !configProtected?.logs_group_id) {
    logger.error("Bot token or logs group ID not found in configProtected for this environment");
    throw new Error("Bot token or logs group ID not found in configProtected for this environment");
  }

  let { bot_token_logs: BOT_TOKEN_LOGS, logs_group_id: LOGS_GROUP_ID } = configProtected;

  // 2) If the caller provided a custom group_id, override
  if (props.group_id) {
    LOGS_GROUP_ID = props.group_id.toString();
  }

  // 3) Determine pinned topic message if any
  const topicMapping: Record<"no_topic" | "event" | "ticket" | "system" | "payments" | "campaign", string | null> = {
    event: configProtected.events_topic,
    ticket: configProtected.tickets_topic,
    system: configProtected.system_topic,
    payments: configProtected.payments_topic,
    campaign: configProtected.campaign_topic,
    no_topic: "no_topic",
  };

  const topicMessageId = topicMapping[props.topic];
  if (!topicMessageId) {
    logger.error(`Invalid or unconfigured topic: ${props.topic}`);
    throw new Error(`Invalid or unconfigured topic: ${props.topic}`);
  }

  // 4) Create a grammY bot instance
  const logBot = new Bot(BOT_TOKEN_LOGS);

  // 5) Decide the final 'reply_to_message_id'
  //    - if props.reply_to_message_id is provided, use it
  //    - else if topic != "no_topic", use pinned topic message_id
  //    - else undefined (no reply)
  let finalReplyTo: number | undefined;
  if (typeof props.reply_to_message_id === "number") {
    finalReplyTo = props.reply_to_message_id;
  } else if (topicMessageId !== "no_topic") {
    finalReplyTo = Number(topicMessageId);
  }

  if (props.media_group && props.media_group.length > 0) {
    // Telegram does not allow inline keyboards or individual captions on media groups.
    // We'll fetch each item from the URL and build the array of InputMedia.
    const mediaArray: (InputMediaPhoto | InputMediaVideo)[] = [];

    for (const item of props.media_group) {
      // 6a) Download the file
      const response = await axios.get(item.url, { responseType: "arraybuffer" });
      const buffer = response.data;

      if (item.type === "photo") {
        mediaArray.push({
          type: "photo",
          media: new InputFile(buffer), // or direct URL if Telegram can handle it
        });
      } else {
        // treat as "video"
        mediaArray.push({
          type: "video",
          media: new InputFile(buffer),
        });
      }
    }

    // 6b) sendMediaGroup has no 'reply_markup' support
    //     We can optionally thread it via reply_to_message_id
    const mediaGroupMessageId = await logBot.api.sendMediaGroup(Number(LOGS_GROUP_ID), mediaArray, {
      reply_to_message_id: finalReplyTo,
    });
    logger.log("Sent media group message", Number(LOGS_GROUP_ID), mediaGroupMessageId);
    // Note: If you want a single “caption” for the entire media group, you can put it
    // on the *first* item’s caption field. But then you can't do multiple separate captions
    // for each item in the group.
  }
  // 6) If sending an image
  if (props.image) {
    const response = await axios.get(props.image, { responseType: "arraybuffer" });
    const buffer = response.data;

    logger.log("Sending telegram photo message", Number(LOGS_GROUP_ID), props.image, {
      caption: props.message,
      reply_to_message_id: finalReplyTo, // <--- Use grammY's reply_to_message_id
      reply_markup: props.inline_keyboard,
      parse_mode: "HTML",
    });

    return await logBot.api.sendPhoto(Number(LOGS_GROUP_ID), new InputFile(buffer), {
      caption: props.message,
      reply_to_message_id: finalReplyTo, // optional
      reply_markup: props.inline_keyboard,
      parse_mode: "HTML",
    });
  }

  // 7) Otherwise, plain text message
  return await logBot.api.sendMessage(Number(LOGS_GROUP_ID), props.message, {
    parse_mode: "HTML",
    reply_to_message_id: finalReplyTo, // optional
    reply_markup: props.inline_keyboard,
    link_preview_options: { is_disabled: true },
  });
};
// CSV log sender
export type CsvLogProps = {
  message: string;
  topic: "event" | "ticket" | "system" | "payments" | "no_topic";
  csvFileName: string;
  csvContent: string;
  inline_keyboard?: InlineKeyboardMarkup;
  group_id?: number | string | null;
};

export async function sendLogNotificationWithCsv(props: CsvLogProps) {
  if (!configProtected?.bot_token_logs || !configProtected?.logs_group_id) {
    logger.error("Bot token or logs group ID not found in configProtected for this environment");
    throw new Error("Bot token or logs group ID not found in configProtected for this environment");
  }

  let { bot_token_logs: BOT_TOKEN_LOGS, logs_group_id: LOGS_GROUP_ID } = configProtected;

  // If a different group/chat ID is specified
  if (props.group_id) {
    LOGS_GROUP_ID = props.group_id.toString();
  }

  const topicMapping: Record<"no_topic" | "event" | "ticket" | "system" | "payments", string | null> = {
    event: configProtected.events_topic,
    ticket: configProtected.tickets_topic,
    system: configProtected.system_topic,
    payments: configProtected.payments_topic,
    no_topic: "no_topic",
  };

  const topicMessageId = topicMapping[props.topic];
  if (!topicMessageId) {
    logger.error(`Invalid or unconfigured topic: ${props.topic}`);
    throw new Error(`Invalid or unconfigured topic: ${props.topic}`);
  }

  const logBot = new Bot(BOT_TOKEN_LOGS);

  // Create a buffer for the CSV file
  const csvBuffer = Buffer.from(props.csvContent, "utf-8");

  logger.log("Sending telegram message with CSV attachment to", LOGS_GROUP_ID, {
    caption: props.message,
    reply_parameters:
      topicMessageId === "no_topic"
        ? undefined
        : {
            message_id: Number(topicMessageId),
          },
  });

  // Use sendDocument to attach the CSV
  return await logBot.api.sendDocument(Number(LOGS_GROUP_ID), new InputFile(csvBuffer, props.csvFileName), {
    caption: props.message,
    reply_parameters: topicMessageId === "no_topic" ? undefined : { message_id: Number(topicMessageId) },
    reply_markup: props.inline_keyboard,
    parse_mode: "HTML",
  });
}

// =========== RENDER FUNCTIONS ===========

export const renderUpdateEventMessage = (
  username: string | number,
  eventUuid: string,
  event_title: string,
  _oldChanges: any,
  _updateChanges: any
): string => {
  return `
@${username} <b>Updated</b> event <code>${event_title}</code> successfully
🔗Event Link: https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}
`;
};

export const renderAddEventMessage = (username: string | number, eventData: EventRow): string => {
  const eventUuid = eventData.event_uuid;
  const eventDataWithoutDescription = removeSecretKey(removeKey(eventData, "description"));
  return `
@${username} <b>Added</b> a new event <code>${eventUuid}</code> successfully

<pre><code>${eventDataWithoutDescription}</code></pre>

Open Event: https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}
`;
};

export async function renderModerationEventMessage(
  username: string | number,
  eventData: EventRow,
  isNewMessage: boolean = true
): Promise<string> {
  const eventUuid = eventData.event_uuid;

  // 1) Count how many notices the event owner has
  const totalNotices = await moderationLogDB.getNoticeCountForOwner(eventData.owner);

  // 2) Compute circle color
  const circleEmoji = getNoticeEmoji(totalNotices);

  // 3) Prepare event data display (excluding the `description`)

  // 4) Return message with a notice count line
  const UpdateText = isNewMessage ? "🆕🆕New Event 🆕🆕" : `🔄Updated But Reply To message not found🔄`;
  return `
${UpdateText}

<b>${eventData.title}</b> ${circleEmoji}

${eventData.subtitle}

${circleEmoji} User currently has <b>${totalNotices}</b> notice(s).

@${username}

Open Event: https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}
`;
}

// ======================================== //
//     PUBLISH EVENT ON EVENTS CHANNEL      //
// ======================================== //
export async function sendToEventsTgChannel(props: {
  image: string;
  title: string;
  subtitle: string;
  s_date: number;
  e_date: number;
  event_uuid: string;
  timezone: string | null;
  participationType: string;
  ticketPrice?: {
    paymentType: string;
    amount: number;
  };
}) {
  try {
    const eventChannelPublisherBot = await getEventsChannelBotInstance();

    return await eventChannelPublisherBot.api.sendPhoto(
      Number(configProtected.events_channel),
      props.image, // image url
      {
        caption: `<b>${props.title}</b>

<i>${props.subtitle}</i>

📍 <i>${props.participationType.split("_").join(" ").charAt(0).toUpperCase() + props.participationType.split("_").join(" ").slice(1)} ${props.ticketPrice ? "Paid" : "Free"}</i>
${props.ticketPrice ? `\n${props.ticketPrice.paymentType === "ton" ? "💎" : props.ticketPrice.paymentType === "star" ? "⭐" : "💲"} <b>Ticket Price:</b> ${props.ticketPrice.amount}${props.ticketPrice.paymentType}\n` : ""}
👉 <a href="https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${props.event_uuid}">Open event on ONTON</a>

⏰ <b>Starts at:</b> ${new Date(props.s_date * 1000).toLocaleString("en-US", {
          timeZone: props.timezone || "UTC",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
          hour12: false,
        })}

⏰ <b>Ends at:</b> ${new Date(props.e_date * 1000).toLocaleString("en-US", {
          timeZone: props.timezone || "UTC",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
          hour12: false,
        })}

🔵 <b>ONTON <a href="https://t.me/+eErXwpP8fDw3ODY0">News</a> | <a href="${TG_SUPPORT_GROUP}">Community</a> | <a href="https://t.me/theontonbot">ONTON bot</a> | <a href="https://x.com/ontonbot">X</a> | <a href="${TG_SUPPORT_GROUP}/122863">Tutorials</a></b> | <a href="https://t.me/onton_events">Events</a>`,
        parse_mode: "HTML",
      }
    );
  } catch (err) {
    logger.error("FAILED_TO_PUBLISH_ON_EVENTS_CHANNEL:", err);
  }
}

export const renderModerationFlowup = (username: string | number): string =>
  `
<b>Event Updated Again</b>
by @${username}

Please re-check this event (needs moderation).
`.trim();

export const callCreateInviteLink = async (
  chat_id: number,
  options: { creates_join_request?: boolean; name?: string }
): Promise<{ success: boolean; invite_link?: string }> => {
  try {
    // This is just an example; replace with your actual endpoint
    const resp = await tgClientPost(`create-invite`, {
      chat_id,
      creates_join_request: options.creates_join_request,
      name: options.name,
    });

    if (resp.data.success) {
      return { success: true, invite_link: resp.data.invite_link };
    }
    return { success: false };
  } catch (err) {
    throw err;
  }
};

export const callDeleteInviteLink = async (chat_id: number, invite_link: string): Promise<{ success: boolean }> => {
  try {
    const resp = await tgClientPost(`delete-invite`, {
      chat_id,
      invite_link,
    });
    return { success: resp.data.success === true };
  } catch (err) {
    throw err;
  }
};

export const callCheckBotAdmin = async (chatId: number): Promise<{ success: boolean; chatInfo?: any }> => {
  const body = { chat_id: chatId };
  const resp = await tgClientPost("check-bot-admin", body);
  return resp.data; // e.g. { success: true, chatInfo: { ... } }
};
