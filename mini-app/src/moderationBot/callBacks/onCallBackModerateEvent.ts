import eventDB from "@/db/modules/events.db";
import { CreateTonSocietyDraft } from "@/services/tonSocietyService";
import { registerActivity } from "@/lib/ton-society-api";
import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

export const onCallBackModerateEvent = async (status: string, event_uuid: string) => {
  const eventData = await eventDB.selectEventByUuid(event_uuid);
  const isLocal = process.env.ENV === "local";
  if (!eventData) return false;

  if (!isLocal) {
    const eventDraft = await CreateTonSocietyDraft(
      {
        title: eventData.title,
        subtitle: eventData.subtitle,
        description: eventData.description,
        location: eventData.location!,
        countryId: eventData.countryId,
        society_hub: { id: eventData.society_hub_id! },
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        ts_reward_url: eventData.tsRewardImage,
        video_url: eventData.tsRewardVideo,
        eventLocationType: eventData.participationType,
      },
      event_uuid
    );
    let ton_society_result = undefined;
    if (!eventData.activity_id) {
      ton_society_result = await registerActivity(eventDraft);
    }

    if (eventData.activity_id || ton_society_result) {
      const activity_id = eventData.activity_id || ton_society_result!.data.activity_id;
      await db.transaction(async (trx) => {
        await trx
          .update(events)
          .set({
            activity_id: activity_id,
            hidden: false,
            enabled: true,
            updatedBy: "Moderation-Approve",
            updatedAt: new Date(),
          })
          .where(eq(events.event_uuid, event_uuid))
          .execute();
        await eventDB.deleteEventCache(event_uuid);
        logger.log(`paid_event_add_activity_${eventData.event_uuid}_${activity_id}`);
      });

      const updatedEvent = await db.query.events.findFirst({
        where: eq(events.event_uuid, event_uuid),
        columns: {
          activity_id: true,
        },
      });

      logger.log("tgBot_moderation_approve event_uuid , activity_id", event_uuid, updatedEvent?.activity_id);
      return updatedEvent?.activity_id;
    } else {
      return null;
    }
  }

  return false;
};
