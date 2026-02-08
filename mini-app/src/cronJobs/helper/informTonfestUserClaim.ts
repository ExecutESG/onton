import { callTaskImmediate } from "@/lib/callTaskImmediate";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { ALLOWED_TONFEST_EVENT_UUIDS } from "@/constants";
import ordersDB from "@/db/modules/orders.db";
import { is_local_env } from "@/server/utils/evnutils";
import { CallBackTaskFunctionType } from "@/db/schema/callbackTasks";

export const informTonfestUserClaim = async (
  userId: number,
  event_id: number,
  calimCallEndpoint: CallBackTaskFunctionType
) => {
  // Example condition: skip if payment_type is "STAR"
  // or if the event UUID doesn't match certain known IDs.
  const eventData = await eventDB.fetchEventById(event_id);
  if (!eventData?.event_uuid) {
    logger.error(`informTonfestUserClaim: Event not found for event_id ${event_id}`);
    return;
  }
  const eventUuid = eventData?.event_uuid;

  if (!ALLOWED_TONFEST_EVENT_UUIDS.includes(eventUuid) && !is_local_env()) {
    return;
  }

  const order = (await ordersDB.findOrderByEventUserByType(eventUuid, userId, "ts_csbt_ticket")).pop();
  if (!order) {
    logger.error(`informTonfestUserClaim: Order not found for user ${userId} and event ${eventUuid}`);
    return;
  }

  if (order.order_type !== "ts_csbt_ticket") {
    logger.info(`informTonfestUserClaim: Order type is not "ts_csbt_ticket" for order ${order.uuid}`);
    return;
  }

  // Fetch event data (for itemId usage)

  // Build the payload from your order & event context
  const payloadForTonfest = {
    userTelegramId: order.user_id ?? 0,
  };
  logger.log(
    `💎💎💎💎💎💎💎💎Tonfest payload for order=${order.uuid} for endpoint=${calimCallEndpoint}: ${JSON.stringify(payloadForTonfest)}`
  );
  // Make the immediate call to addSbtFromOnton
  const immediateResult = await callTaskImmediate({
    apiName: "TONFEST",
    taskFunction: calimCallEndpoint,
    payload: payloadForTonfest,
    itemType: "EVENT", // for callback_tasks referencing
    itemId: eventData?.event_id ?? 0, // fallback to 0 if not found
  });

  // Log the immediate call result
  logger.log(
    `informTonfestUserClaim: TonFest immediate call result for order=${order.uuid}: ${JSON.stringify(immediateResult)}`
  );
};
