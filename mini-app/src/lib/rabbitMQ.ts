// rabbitMQ.ts

import {
  QueueNames,
  dlxName,
  notificationQueueOptions,
  retryQueueOptions,
  rabbitMQUser,
  rabbitMQUrl,
  rabbitMQPass,
  rabbitMQPort,
} from "@/sockets/constants";
import amqp from "amqplib";
import { Channel, Message, Options, ChannelModel } from "amqplib";
import { logger } from "@/server/utils/logger";

export type QueueNamesType = (typeof QueueNames)[keyof typeof QueueNames];

// Singleton class for RabbitMQ
export class RabbitMQ {
  private static instance: RabbitMQ;
  private connection: ChannelModel | null = null;
  private channels: Map<QueueNamesType, Channel> = new Map();

  private readonly url: string;
  private readonly username: string;
  private readonly password: string;
  private readonly port: number;

  /**
   * Prevents setupQueues() from running more than once.
   */
  private queuesAreSetup: boolean = false;

  private constructor() {
    this.url = rabbitMQUrl;
    this.username = rabbitMQUser;
    this.password = rabbitMQPass;
    this.port = rabbitMQPort;
  }

  /**
   * Initialize the RabbitMQ singleton instance
   */
  public static getInstance(): RabbitMQ {
    if (!RabbitMQ.instance) {
      RabbitMQ.instance = new RabbitMQ();
    }
    return RabbitMQ.instance;
  }

  /**
   * Establish a persistent connection to RabbitMQ
   */
  private async connect(): Promise<ChannelModel> {
    if (!this.connection) {
      try {
        this.connection = await amqp.connect({
          protocol: "amqp",
          hostname: this.url,
          port: this.port,
          username: this.username,
          password: this.password,
        });

        this.connection.on("error", (err) => {
          logger.error("RabbitMQ connection error:", err);
          this.connection = null;
        });

        this.connection.on("close", () => {
          logger.warn("RabbitMQ connection closed.");
          this.connection = null;
        });

        logger.log("RabbitMQ connection established successfully.");

        // Call setupQueues() once, right after establishing the initial connection
        if (!this.queuesAreSetup) {
          await this.setupQueues();
          this.queuesAreSetup = true;
        }
      } catch (error) {
        logger.error("Error connecting to RabbitMQ:", error);
        throw error;
      }
    }
    return this.connection;
  }

  /**
   * Ensure the connection is valid and reconnect if needed
   */
  private async ensureConnection(): Promise<void> {
    if (!this.connection) {
      await this.connect();
    } else {
      try {
        await this.connection.createChannel();
      } catch (error) {
        logger.warn("Connection was invalid, reconnecting...");
        this.connection = null;
        await this.connect();
      }
    }
  }

  /**
   * Get or create a channel for a queue
   */
  private async getChannel(queue: QueueNamesType): Promise<Channel> {
    await this.ensureConnection();

    if (this.channels.has(queue)) {
      return this.channels.get(queue) as Channel;
    }

    try {
      const connection = await this.connect();
      const channel = await connection.createChannel();

      // Use consistent queue options
      let queueOptions = { durable: true };
      if (queue === QueueNames.NOTIFICATIONS) {
        queueOptions = notificationQueueOptions;
      }

      await channel.assertQueue(queue, queueOptions);
      this.channels.set(queue, channel);
      logger.log(`Channel created for queue: '${queue}'`);
      return channel;
    } catch (error) {
      logger.error(`Error creating channel for queue '${queue}':`, error);
      throw error;
    }
  }

  /**
   * Push a message to a queue
   */
  public async push(
    queue: QueueNamesType,
    message: Record<string, any>,
    options: Options.Publish = { persistent: true }
  ): Promise<void> {
    try {
      const channel = await this.getChannel(queue);
      const buffer = Buffer.from(JSON.stringify(message));
      // Ensure persistent is always true unless overridden
      const publishOptions: Options.Publish = { persistent: true, ...options };
      logger.log(`Pushing message to queue '${queue}' with options:`, publishOptions);
      const sent = channel.sendToQueue(queue, buffer, publishOptions);

      if (sent) {
        logger.log(`Message sent to queue '${queue}' with properties:`, publishOptions);
      } else {
        logger.warn(`Message not sent to queue '${queue}':`, message);
      }
    } catch (error) {
      logger.error(`Error pushing message to queue '${queue}':`, error);
    }
  }

  /**
   * Consume messages from a queue
   * @returns The consumer tag for later cancellation
   */
  public async consume(
    queue: QueueNamesType,
    onMessage: (_msg: Message, _channel: Channel) => Promise<void>,
    prefetchCount = 1
  ): Promise<string> {
    try {
      const channel = await this.getChannel(queue);
      // Use consistent queue options
      const queueOptions = queue === QueueNames.NOTIFICATIONS ? notificationQueueOptions : { durable: true };
      logger.log(`Asserting queue '${queue}' before consuming with options:`, queueOptions);
      await channel.assertQueue(queue, queueOptions);
      await channel.prefetch(prefetchCount);

      const consumeResult = await channel.consume(
        queue,
        async (msg) => {
          if (msg) {
            try {
              await onMessage(msg, channel);
            } catch (error) {
              logger.error(`Error processing message from queue '${queue}':`, error);
              channel.nack(msg); // Requeue the message
            }
          }
        },
        { noAck: false }
      );

      logger.log(`Consuming messages from queue '${queue}' with prefetch count ${prefetchCount}`);
      return consumeResult.consumerTag;
    } catch (error) {
      logger.error(`Error consuming messages from queue '${queue}':`, error);
      throw error;
    }
  }

  /**
   * Cancel a consumer using its consumer tag
   */
  public async cancelConsumer(queue: QueueNamesType, consumerTag: string): Promise<void> {
    if (!this.connection) {
      logger.warn(`Attempted to cancel consumer for queue '${queue}' without an active connection.`);
      return;
    }

    try {
      const channel = this.channels.get(queue);
      if (channel) {
        await channel.cancel(consumerTag);
        logger.log(`Consumer with tag '${consumerTag}' for queue '${queue}' canceled successfully.`);
      } else {
        logger.warn(`No channel found for queue '${queue}'.`);
      }
    } catch (error) {
      logger.error(`Error canceling consumer with tag '${consumerTag}' for queue '${queue}':`, error);
    }
  }

  /**
   * Close all channels and the connection
   */
  public async close(): Promise<void> {
    try {
      for (const [queue, channel] of this.channels.entries()) {
        await channel.close();
        logger.log(`Channel for queue '${queue}' closed.`);
      }
      this.channels.clear();

      if (this.connection) {
        await this.connection.close();
        logger.log("RabbitMQ connection closed.");
        this.connection = null;
      }
    } catch (error) {
      logger.error("Error closing RabbitMQ connection:", error);
    }
  }

  /**
   * Set up queues and exchanges
   */
  public async setupQueues(): Promise<void> {
    await this.ensureConnection();

    try {
      const connection = await this.connect();
      const channel = await connection.createChannel();

      // Assert the DLX exchange
      await channel.assertExchange(dlxName, "direct", { durable: true });

      // Original Queue (notifications)
      await channel.assertQueue(QueueNames.NOTIFICATIONS, notificationQueueOptions);

      // Dead-Letter Queue (notifications-retry)
      await channel.assertQueue(`${QueueNames.NOTIFICATIONS}-retry`, retryQueueOptions);

      // Bind the DLX to the dead-letter queue
      await channel.bindQueue(`${QueueNames.NOTIFICATIONS}-retry`, dlxName, `${QueueNames.NOTIFICATIONS}-retry`);

      logger.log("Queues and exchanges setup completed.");
    } catch (error) {
      logger.error("Error setting up queues:", error);
      throw error;
    }
  }
}

// Export utility functions
const rabbit = RabbitMQ.getInstance();

export const pushToQueue = async (queue: QueueNamesType, message: Record<string, any>, options: Options.Publish) => {
  await rabbit.push(queue, message, options);
};

export const consumeFromQueue = async (
  queue: QueueNamesType,
  onMessage: (_msg: Message, _channel: Channel) => Promise<void>,
  prefetchCount = 1
): Promise<string> => {
  return await rabbit.consume(queue, onMessage, prefetchCount);
};
