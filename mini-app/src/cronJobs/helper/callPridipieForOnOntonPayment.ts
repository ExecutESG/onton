import { callTaskImmediate } from "@/lib/callTaskImmediate";
import { OrderRow } from "@/db/schema/orders";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { is_prod_env } from "@/server/utils/evnutils";

const PridipieOrganizers = {
  Zoobinnemati90: 5296635503, // Zoobinnemati90
  Predipie_Support: 6115847231, // Predipie_Support
};

export const callPridipieForOnOntonPayment = async (ordr: OrderRow, eventUuid: string) => {
  const eventData = await eventDB.fetchEventByUuid(eventUuid);
  //  Check if the event owner is a Pridipie organizer
  if (
    !(
      (!is_prod_env() && eventData?.owner === PridipieOrganizers.Zoobinnemati90) ||
      (is_prod_env() && eventData?.owner === PridipieOrganizers.Predipie_Support)
    )
  )
    return;
  logger.log(`call callPridipieForOnOntonPayment`);
  // Build the payload for Pridipie
  const payloadForPridipie = {
    telegramId: String(ordr.user_id ?? 0),
  };

  const immediateResult = await callTaskImmediate({
    apiName: "PRIDIPIE_API",
    taskFunction: "PridipieAUTH",
    payload: payloadForPridipie,
    itemType: "EVENT_ORGANIZER",
    itemId: eventData?.owner ?? 0,
  });

  // Log the call result
  logger.log(`Pridipie immediate call result for order=${ordr.uuid}: ${JSON.stringify(immediateResult)}`);
};
