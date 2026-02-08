import { CreateTonSocietyDraft } from "@/services/tonSocietyService";
import { EventRow } from "@/db/schema/events";

/** Builds a standard Ton Society draft for the main event. */
export const buildEventDraft = async (event: EventRow) =>
  CreateTonSocietyDraft(
    {
      title: event.title,
      subtitle: event.subtitle,
      description: event.description,
      location: event.location ?? "",
      countryId: event.countryId,
      society_hub: { id: event.society_hub_id ?? "" },
      start_date: event.start_date,
      end_date: event.end_date,
      ts_reward_url: event.tsRewardImage,
      video_url: event.tsRewardVideo,
      eventLocationType: event.participationType,
    },
    event.event_uuid
  );
