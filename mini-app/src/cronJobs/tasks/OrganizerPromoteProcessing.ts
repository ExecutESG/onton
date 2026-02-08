import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { and, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { orgPromoteProcessOrder } from "@/services/orgPromoteOrderService";
import { sleep } from "@/utils";

export const OrganizerPromoteProcessing = async () => {
  const organizerOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.order_type, "promote_to_organizer"), eq(orders.state, "processing")))
    .orderBy(orders.created_at)
    .execute();

  for (const processingOrder of organizerOrders) {
    logger.log("OrganizerPromoteProcessing order_uuid : ", processingOrder.uuid);
    await orgPromoteProcessOrder(processingOrder);
    await sleep(50);
  }
};
