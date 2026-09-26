// Description: Constants for the socket server.
export const userSockets: Map<number, Set<string>> = new Map();
export type UserId = number;
export const prefetchCount = Number(process.env.PREFETCH_COUNT) || 70;
export const rabbitMQUser = process.env.RABBITMQ_DEFAULT_USER || "";
export const rabbitMQPass = process.env.RABBITMQ_DEFAULT_PASS || "";
export const rabbitMQUrl = process.env.RABBITMQ_HOST || process.env.IP_RABBITMQ || "rabbitmq";
export const rabbitMQPort = Number(process.env.RABBITMQ_NODE_PORT) || 5672;
// Notification constants
export const retryLimit = 20;
// Retry interval for socket connections
// 🚨🚨🚨🚨🚨🚨 after changing Retry interval for socket connections
// 🚨🚨🚨🚨🚨🚨 you need to delete all queues and exchanges in RabbitMQ !!!!!!!!
export const SOCKET_RETRY_INTERVAL =  5000;
////////////////////////////////////////////////////////////////
// Define the socket events using a TypeScript enum
export const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_BASE_URL  ,
];
// rateLimit:  requests per second
export const RATE_LIMIT_WINDOW_MS = 1000;
export const RATE_LIMIT_MAX = 10;
export const MAIN_NOTIFICATION_TTL = 60 * 4 * 1000 ; // 2 minutes
export const SocketEvents = {
  receive: {
    test: "test",
    notificationReply: "notification_reply",
  },
  send: {
    notification: "notification",
    notFound: "404",
    error: "error",
  },
};

// Define the valid queue names using a TypeScript enum
export const QueueNames = {
  NOTIFICATIONS: `${process.env.STAGE_NAME || "onton"}-notifications`,
  TG_MESSAGES: `${process.env.STAGE_NAME || "onton"}-tg_messages`,
  ORDER_PAID: `${process.env.STAGE_NAME || "onton"}-order_paid`,
} as const;

// Define the dead-letter exchange and queue names
export const dlxName = `${QueueNames.NOTIFICATIONS}-dlx`;

// Define the queue options
export const notificationQueueOptions = {
  durable: true,
  arguments: {
    "x-message-ttl": MAIN_NOTIFICATION_TTL,
    "x-dead-letter-exchange": dlxName,
    "x-dead-letter-routing-key": `${QueueNames.NOTIFICATIONS}-retry`,
  },
};

// Define the retry queue options
export const retryQueueOptions = {
  durable: true,
  arguments: {
    "x-message-ttl": SOCKET_RETRY_INTERVAL,
    "x-dead-letter-exchange": "", // Default exchange
    "x-dead-letter-routing-key": QueueNames.NOTIFICATIONS,
  },
};

//  Define Notification Related Constants
export const NOTIFICATION_TIMEOUT_MARGIN = 15; // 10 seconds

// action timeout in seconds
export const ACTION_TIMEOUTS = {
  POA_SIMPLE: 30,
  POA_PASSWORD: 75,
}

// Define the maximum number of retries for a password notification
export const PASSWORD_RETRY_LIMIT = 3;

// POA Worker Constants
export const WORKER_INTERVAL = 4 * 1000; // 5 seconds
export const PAGE_SIZE = 500; // Number of users to fetch per batch
export const POA_CREATION_LIMIT = 4; // Maximum number of POA creation notifications to send per batch
export const POA_CREATION_TIME_DISTANCE = (5 * 60) + 2; // 10 minutes
