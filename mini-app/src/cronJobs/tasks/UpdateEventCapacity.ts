import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { and, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { eventPayment } from "@/db/schema/eventPayment";
import { events } from "@/db/schema/events";

export const UpdateEventCapacity = async () => {
  const results = await db
    .select()
    .from(orders)
    .where(and(eq(orders.state, "processing"), eq(orders.order_type, "event_capacity_increment")))
    .execute();

  /* -------------------------------------------------------------------------- */
  /*                               Event UPDATE                                 */
  /* -------------------------------------------------------------------------- */
  for (const order of results) {
    try {
      const event_uuid = order.event_uuid;
      if (!event_uuid) {
        //NOTE - tg log
        logger.error("error_CronJob--CreateOrUpdateEvent_Orders---eventUUID is null order=", order.uuid);
        continue;
      }
      // const event = await modules.select().from(events).where(eq(events.event_uuid, event_uuid)).execute();
      const event = await eventDB.selectEventByUuid(event_uuid);

      if (!event) {
        //NOTE - tg log
        logger.error("error_CronJob--CreateOrUpdateEvent_Orders---event is null event=", event_uuid);
        continue;
      }
      const eventData = event;

      const paymentInfo = (
        await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid)).execute()
      ).pop();

      if (!paymentInfo) {
        //NOTE - tg log
        logger.error("error_what the fuck : ", "event Does not have payment !!!");
        continue;
      }

      await db.transaction(async (trx) => {
        //const newCapacity = Number(paymentInfo?.bought_capacity! + order.total_price / 0.06);
        const newCapacity = Math.floor((paymentInfo?.bought_capacity || 0) + order.total_price / 0.06 + Number.EPSILON);
        logger.log(
          `( bought_capacity ${paymentInfo?.bought_capacity}  + order.total_price ${order.total_price} ) => newCapacity  ${newCapacity}`
        );
        await trx.update(events).set({ capacity: newCapacity }).where(eq(events.event_uuid, eventData.event_uuid)).execute();
        await eventDB.deleteEventCache(eventData.event_uuid);

        await trx
          .update(eventPayment)
          .set({ bought_capacity: newCapacity })
          .where(eq(eventPayment.event_uuid, eventData.event_uuid))
          .execute();
        await trx.update(orders).set({ state: "completed" }).where(eq(orders.uuid, order.uuid)).execute();
      });
    } catch (error) {
      logger.error(`UpdateEventCapacity_error ${error}`);
    }
  }
};
