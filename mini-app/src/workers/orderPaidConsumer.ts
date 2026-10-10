import "@/server/utils/assertSecretsOnBoot";
import { RabbitMQ } from "@/lib/rabbitMQ";
import { QueueNames } from "@/sockets/constants";
import { logger } from "@/server/utils/logger";
import { processSinglePaidOrder } from "@/cronJobs/tasks/MintNFTForPaidOrders";

/**
 * Starts the RabbitMQ consumer for the `order.paid` event.
 * Provides instant (<1s) ticket issuance and NFT minting upon payment confirmation.
 */
export async function startOrderPaidConsumer(): Promise<void> {
  try {
    const rabbit = RabbitMQ.getInstance();

    logger.log(`[OrderPaidConsumer] Subscribing to queue: ${QueueNames.ORDER_PAID}`);

    await rabbit.consume(QueueNames.ORDER_PAID, async (msg, channel) => {
      try {
        const content = msg.content.toString();
        const payload = JSON.parse(content);
        const { orderUuid, eventUuid, userId, paymentMethod } = payload;

        logger.log(
          `[OrderPaidConsumer] Received order.paid event: order=${orderUuid}, event=${eventUuid}, user=${userId}, method=${paymentMethod}`
        );

        if (!orderUuid) {
          logger.warn("[OrderPaidConsumer] Received order.paid message without orderUuid, acknowledging and discarding");
          channel.ack(msg);
          return;
        }

        const success = await processSinglePaidOrder(orderUuid);
        if (success) {
          logger.log(`[OrderPaidConsumer] Successfully fulfilled order: ${orderUuid}`);
        } else {
          logger.warn(`[OrderPaidConsumer] processSinglePaidOrder returned false for order: ${orderUuid}`);
        }

        channel.ack(msg);
      } catch (err) {
        logger.error("[OrderPaidConsumer] Error processing message:", err);
        // Acknowledge to prevent poison-pill message loops; cron safety net will catch any missed orders
        channel.ack(msg);
      }
    });

    logger.log("[OrderPaidConsumer] Consumer started successfully");
  } catch (error) {
    logger.warn("[OrderPaidConsumer] Failed to connect/subscribe to RabbitMQ; cron fallback will handle orders:", error);
  }
}
