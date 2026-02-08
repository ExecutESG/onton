import { db } from "@/db/db";
import { eventPayment } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { logger } from "@/server/utils/logger";

/** Fetches a single eventPayment record, if present. */
export const fetchPaymentInfoForCronjob = async (event_uuid: string): Promise<EventPaymentSelectType | undefined> => {
  const [info] = await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid)).execute();
  if (!info) {
    logger.error("CronJob--CreateOrUpdateEvent_Orders---No payment info for event=", event_uuid);
  }
  return info;
};

const eventPaymentDB = {
  fetchPaymentInfoForCronjob,
};
export default eventPaymentDB;
