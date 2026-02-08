import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { eventPayment } from "@/db/schema/eventPayment";
import { events } from "@/db/schema/events";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { registerActivity } from "@/lib/ton-society-api";
import type { OrderRow } from "@/db/schema/orders";
import type { EventRow } from "@/db/schema/events";
import type { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { buildEventDraft } from "@/cronJobs/helper/buildEventDraft";
import ordersDB from "@/db/modules/orders.db";
import eventPaymentDB from "@/db/modules/eventPayment.db";
import { handleTicketType } from "@/cronJobs/helper/handleTicketType";
import { isAxiosError } from "axios";

/**
 * Main entry for your cron job:
 * 1) Fetch orders where state = 'processing' and order_type = 'event_creation'
 * 2) Process each order
 */
export const CreateEventOrders = async () => {
  try {
    // 1) Retrieve all event-creation orders that are still in "processing"
    const processingOrders = await ordersDB.getProcessingEventCreationOrders();

    // 2) Process each order
    for (const order of processingOrders) {
      await processOrderCreation(order);
    }
  } catch (error) {
    logger.error(`CreateEventOrders cron job encountered an error: ${error}`);
  }
};

/**
 * Processes a single "event_creation" order:
 * - Fetches the associated event & payment data
 * - Registers main TonSociety event if missing
 * - Handles NFT or TSCSBT logic
 * - Updates DB in a transaction
 */
async function processOrderCreation(order: OrderRow) {
  try {
    const event_uuid = order.event_uuid;
    if (!event_uuid) {
      logger.error("CronJob--CreateOrUpdateEvent_Orders---eventUUID is null order=", order.uuid);
      return;
    }

    // Fetch the main event
    const event = await eventDB.fetchEventByUuid(event_uuid);
    if (!event) {
      logger.error("CronJob--CreateOrUpdateEvent_Orders---event is null event=", event_uuid);
      return;
    }

    // Prepare the main TonSociety draft for the event
    const eventDraft = await buildEventDraft(event);

    // Fetch associated payment info
    const paymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(event_uuid);

    // Create the main Ton Society Event if missing
    let mainEventActivityId = event.activity_id;
    if (!mainEventActivityId) {
      //&& process.env.ENV !== "local"
      logger.log(`registerActivity for event ${event_uuid}:`, eventDraft);
      const tonSocietyResult = await registerActivity(eventDraft);
      logger.log(`registerActivity for event ${event_uuid}:`, tonSocietyResult);
      mainEventActivityId = tonSocietyResult.data.activity_id;
      if (mainEventActivityId) {
        await eventDB.updateActivityId(event_uuid, mainEventActivityId);
      }
    }

    // Handle ticket-type specific logic (NFT or TSCSBT)
    const { collectionAddress, ticketActivityId } = await handleTicketType(event, paymentInfo);

    // Update DB in a transaction
    await updateDatabaseRecords(order, event, paymentInfo, mainEventActivityId, collectionAddress, ticketActivityId);
  } catch (error) {
    if (isAxiosError(error)) {
      logger.error("event_creation_error", {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
        headers: error.response?.headers,
      });
    } else {
      logger.error("event_creation_error", error);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */

/* -------------------------------------------------------------------------- */

/**
 * Updates the DB records in a transaction:
 *  - Updates the event's activity_id if newly created
 *  - Updates eventPayment with new collectionAddress or ticket_activity_id
 *  - Marks the order as completed if everything is in place
 */
async function updateDatabaseRecords(
  order: OrderRow,
  event: EventRow,
  paymentInfo: EventPaymentSelectType | undefined,
  mainEventActivityId: number | null | undefined,
  collectionAddress: string | null,
  ticketActivityId: number | null
) {
  await db.transaction(async (trx) => {
    // Update main event activity_id if newly created
    if (mainEventActivityId && event.activity_id !== mainEventActivityId) {
      await trx
        .update(events)
        .set({
          activity_id: mainEventActivityId,
          hidden: false,
          enabled: true,
          updatedBy: "CreateEventOrders-JOB",
          updatedAt: new Date(),
        })
        .where(eq(events.event_uuid, event.event_uuid))
        .execute();

      // Clear event cache
      await eventDB.deleteEventCache(event.event_uuid);
      logger.log(`paid_event_add_activity_${event.event_uuid}_${mainEventActivityId}`);
    }

    // Update eventPayment fields if needed (collection address / ticket_activity_id)
    if (paymentInfo) {
      const updates: Record<string, any> = {
        updatedBy: "CreateEventOrders",
        updatedAt: new Date(),
      };

      // If we have a new NFT collection address
      if (collectionAddress && collectionAddress !== paymentInfo.collectionAddress) {
        updates.collectionAddress = collectionAddress;
      }

      // If we have a new TSCSBT ticket activity
      if (ticketActivityId) {
        updates.ticketActivityId = ticketActivityId;
      }

      const hasPaymentInfoUpdates = updates.collectionAddress || updates.ticketActivityId;

      if (hasPaymentInfoUpdates) {
        await trx.update(eventPayment).set(updates).where(eq(eventPayment.id, paymentInfo.id)).execute();
        logger.log(`Update eventPayment for event ${event.event_uuid}:`, JSON.stringify(updates));
      }
    }

    // Mark order as completed if we have the main event activity and
    // either an NFT collection address or TSCSBT activity.
    const hasMainActivity = mainEventActivityId || event.activity_id;
    const hasNFTorTicketInfo =
      paymentInfo?.ticket_type === "NFT" ? collectionAddress : ticketActivityId || paymentInfo?.ticketActivityId;

    if (hasMainActivity && hasNFTorTicketInfo) {
      await trx
        .update(orders)
        .set({
          state: "completed",
          updatedBy: "CreateEventOrders",
          updatedAt: new Date(),
        })
        .where(eq(orders.uuid, order.uuid))
        .execute();

      logger.log(`paid_event_creation_completed_${event.event_uuid}`);
    } else {
      throw new Error(`paid_event_creation_error Missing data for event ${event.event_uuid}`);
    }
  });
}
