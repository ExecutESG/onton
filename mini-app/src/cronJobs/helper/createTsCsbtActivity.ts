import { EventRow } from "@/db/schema/events";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { CreateTonSocietyDraft } from "@/services/tonSocietyService";
import { registerActivity } from "@/lib/ton-society-api";
import { logger } from "@/server/utils/logger";

/**
 * Creates a separate "ticket activity" in TonSociety for TSCSBT.
 * The start_date is now, and the end_date matches the event’s end_date.
 * Returns the new activity_id as a number.
 */
export const createTsCsbtActivity = async (event: EventRow, paymentInfo: EventPaymentSelectType): Promise<number> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const ticketDraft = await CreateTonSocietyDraft(
    {
      title: paymentInfo.title ?? `${event.title} - Ticket`,
      subtitle: event.subtitle ?? "",
      description: paymentInfo.description ?? event.description,
      location: event.location ?? "",
      countryId: event.countryId,
      society_hub: { id: event.society_hub_id ?? "" },
      start_date: nowInSeconds,
      end_date: event.end_date,
      ts_reward_url: paymentInfo.ticketImage,
      video_url: paymentInfo.ticketVideo,
      eventLocationType: event.participationType,
    },
    `${event.event_uuid}-ticket`
  );
  logger.log(`Created TSCSBT ticket draft for event ${event.event_uuid}` + JSON.stringify(ticketDraft));
  if (process.env.ENV !== "local" || 1) {
    const ticketActivityResult = await registerActivity(ticketDraft);
    const ticketActivityId = ticketActivityResult.data.activity_id;
    logger.log(`Created TSCSBT ticket activity ${ticketActivityId} for event ${event.event_uuid}`);
    return ticketActivityId;
  } else {
    logger.log(`for local env, skipping registerActivity call`);
    return 0;
  }
};
