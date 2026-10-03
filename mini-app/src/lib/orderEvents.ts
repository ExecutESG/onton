import { RabbitMQ } from "@/lib/rabbitMQ";
import { QueueNames } from "@/sockets/constants";
import { logger } from "@/server/utils/logger";

export interface OrderPaidEventPayload {
  orderUuid: string;
  eventUuid?: string;
  userId?: number;
  paymentMethod?: string;
  timestamp?: number;
}

/**
 * Publishes an `order.paid` event to RabbitMQ for instant (<1s) ticket fulfillment & minting.
 * Resilient against RabbitMQ downtime: catches errors and falls back to cron polling.
 */
export async function publishOrderPaidEvent(payload: OrderPaidEventPayload): Promise<boolean> {
  try {
    const rabbit = RabbitMQ.getInstance();
    const eventMessage = {
      ...payload,
      timestamp: payload.timestamp || Date.now(),
    };

    await rabbit.push(QueueNames.ORDER_PAID, eventMessage);
    logger.log(`[RabbitMQ] Published order.paid event for order: ${payload.orderUuid}`);
    return true;
  } catch (error) {
    logger.warn(
      `[RabbitMQ] Failed to publish order.paid for ${payload.orderUuid}; falling back to cron polling:`,
      error
    );
    return false;
  }
}
