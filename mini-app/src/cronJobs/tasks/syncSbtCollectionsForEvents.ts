import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { eventPayment } from "@/db/schema/eventPayment";
import { eq, and, isNull, isNotNull, not, desc } from "drizzle-orm";
import eventDB from "@/db/modules/events.db";
import { logger } from "@/server/utils/logger";
import { getFullActivityDetails } from "@/lib/ton-society-api";
import { sleep } from "@/utils";
import {
  sendLogNotificationWithCsv,
  // sendLogNotification, // (optionally, if you want a plain notification for "nothing to do")
} from "@/lib/tgBot";
import { csvEscape, formatCountMessage } from "../helper/syncSbtCollectionsForEvent.helpers";

interface RecordBase {
  activityId: number;
  title: string;
  createdAt: Date | null;
}

// A record for an "event"
interface EventRecord extends RecordBase {
  recordType: "event";
  eventUuid: string; // This is never null for events
}

// A record for a "ticket"
interface TicketRecord extends RecordBase {
  recordType: "ticket";
  eventUuid: string | null; // This may be null for tickets
}

// The union type
type CombinedRecord = EventRecord | TicketRecord;
/**
 * We'll reuse the same BATCH_SIZE for both events & tickets.
 * Adjust as needed.
 */
const BATCH_SIZE = 30000;

export const syncSbtCollectionsForEvents = async () => {
  let offsetEvents = 0;
  let offsetTickets = 0;

  // Arrays to track problem cases
  const notFoundOrErrorRecords: {
    recordType: "event" | "ticket";
    eventUuid: string;
    title: string;
    activityId: number;
    error: string;
    createdAt: Date | null;
  }[] = [];

  const noCollectionRecords: {
    recordType: "event" | "ticket";
    eventUuid: string;
    title: string;
    activityId: number;
    createdAt: Date | null;
  }[] = [];

  /**
   * We'll process repeatedly until no more 'event' or 'ticket' results
   * come back. If both queries eventually return zero, we break.
   */
  while (true) {
    await sleep(100);

    // 1) Find events missing sbt_collection_address
    const pendingEvents = await db
      .select({
        eventUuid: events.event_uuid,
        activityId: events.activity_id,
        title: events.title,
        createdAt: events.created_at,
      })
      .from(events)
      .where(
        and(
          isNotNull(events.activity_id),
          eq(events.hidden, false),
          not(eq(events.activity_id, -100)),
          isNull(events.sbt_collection_address) // missing SBT collection
        )
      )
      .orderBy(desc(events.event_id))
      .limit(BATCH_SIZE)
      .offset(offsetEvents);

    // 2) Find TSCSBT tickets missing collectionAddress
    //    They need a valid ticket_activity_id
    const pendingTickets = await db
      .select({
        eventUuid: eventPayment.event_uuid,
        activityId: eventPayment.ticketActivityId,
        title: eventPayment.title,
        createdAt: eventPayment.created_at,
      })
      .from(eventPayment)
      .where(
        and(
          eq(eventPayment.ticket_type, "TSCSBT"),
          isNotNull(eventPayment.ticketActivityId),
          isNull(eventPayment.collectionAddress) // missing collection
        )
      )
      .orderBy(desc(eventPayment.id))
      .limit(BATCH_SIZE)
      .offset(offsetTickets);

    logger.info(`Found ${pendingEvents.length} events + ${pendingTickets.length} TSCSBT tickets missing collection`);

    // If we have nothing in either query, we're done
    if (pendingEvents.length === 0 && pendingTickets.length === 0) {
      break;
    }

    // Increase offsets
    offsetEvents += pendingEvents.length;
    offsetTickets += pendingTickets.length;

    // Combine into a single array with recordType
    const combinedRecords: CombinedRecord[] = [
      ...pendingEvents.map<CombinedRecord>((evt) => ({
        recordType: "event",
        eventUuid: evt.eventUuid,
        activityId: evt.activityId!,
        title: evt.title,
        createdAt: evt.createdAt,
      })),
      ...pendingTickets.map<CombinedRecord>((tkt) => ({
        recordType: "ticket",
        // If ticket can have `null` eventUuid, we keep it as is
        eventUuid: tkt.eventUuid,
        activityId: tkt.activityId!,
        title: tkt.title ?? "",
        createdAt: tkt.createdAt,
      })),
    ];

    for (const record of combinedRecords) {
      try {
        // We fetch the Ton Society details using the record's activityId
        const activityResponse = await getFullActivityDetails(record.activityId);
        const collection_address = activityResponse.data?.rewards?.collection_address;

        // If the API returned a collection address
        if (collection_address) {
          if (record.recordType === "event") {
            // Update the events table
            await db
              .update(events)
              .set({ sbt_collection_address: collection_address })
              .where(eq(events.event_uuid, record.eventUuid))
              .execute();

            await eventDB.deleteEventCache(record.eventUuid);

            logger.info(
              `Updated event "${record.eventUuid}" with sbt_collection_address: ${collection_address} (activity ${record.activityId})`
            );
          } else {
            // recordType === "ticket"
            // Update the eventPayment table
            await db
              .update(eventPayment)
              .set({ collectionAddress: collection_address })
              .where(eq(eventPayment.event_uuid, record.eventUuid!!))
              .execute();

            logger.info(
              `Updated TSCSBT ticket for event "${record.eventUuid}" with collectionAddress: ${collection_address} (ticket_activity_id ${record.activityId})`
            );
          }
        } else {
          // No collection address from the API
          noCollectionRecords.push({
            recordType: record.recordType,
            eventUuid: record.eventUuid!!,
            title: record.title,
            activityId: record.activityId,
            createdAt: record.createdAt,
          });
          logger.info(
            `No collection address in activity ${record.activityId} for ${record.recordType} "${record.eventUuid}"`
          );
        }

        // Small delay
        await sleep(100);
      } catch (error: any) {
        notFoundOrErrorRecords.push({
          recordType: record.recordType,
          eventUuid: record.eventUuid!!,
          title: record.title,
          activityId: record.activityId,
          error: String(error.message || error),
          createdAt: record.createdAt,
        });
        logger.error(`Failed to sync collection address for ${record.recordType} "${record.eventUuid}"`, error);
      }
    }
  }

  // Final summary
  const missingMsg = formatCountMessage(
    noCollectionRecords.length,
    "record missing collection",
    "records missing collection"
  );
  const errorMsg = formatCountMessage(notFoundOrErrorRecords.length, "error", "errors");
  const finalMessage = `<b>🔄 SBT Sync Completed</b>\n${missingMsg}\n${errorMsg}`;

  // If we have any problems, produce a CSV
  if (noCollectionRecords.length > 0 || notFoundOrErrorRecords.length > 0) {
    const csvRows = ["recordType,event_uuid,Title,activity_id,error_message,CreationDate"];

    // Error records
    for (const ev of notFoundOrErrorRecords) {
      const sanitizedError = ev.error.replace(/[\r\n]/g, " ");
      csvRows.push(
        [
          ev.recordType,
          csvEscape(ev.eventUuid),
          csvEscape(ev.title),
          ev.activityId,
          csvEscape(sanitizedError),
          ev.createdAt ?? "",
        ].join(",")
      );
    }

    // Missing-collection records
    for (const ev of noCollectionRecords) {
      csvRows.push(
        [
          ev.recordType,
          csvEscape(ev.eventUuid),
          csvEscape(ev.title),
          ev.activityId,
          "NO_COLLECTION_IN_API",
          ev.createdAt ?? "",
        ].join(",")
      );
    }

    const csvContent = csvRows.join("\n");

    await sendLogNotificationWithCsv({
      message: finalMessage,
      topic: "system",
      csvFileName: "MissingSBTCollectionRecords.csv",
      csvContent,
    });
  } else {
    // If no issues
    logger.log(`No missing or error records`);
    // Optionally send a simple text notification
    // await sendLogNotification({ message: finalMessage, topic: "system" });
  }
};
