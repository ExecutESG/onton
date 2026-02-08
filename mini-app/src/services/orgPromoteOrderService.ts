import { db } from "@/db/db";
import { orders } from "@/db/schema";
import { sendLogNotification } from "@/lib/tgBot";
import { selectUserById, updateUserRole } from "@/db/modules/users.db";
import { logger } from "@/server/utils/logger";
import { InferSelectModel, and, count, eq } from "drizzle-orm";
import { is_mainnet } from "./tonCenter";

type OrderRow = InferSelectModel<typeof orders>;

export async function orgPromoteProcessOrder(order: OrderRow): Promise<void> {
  try {
    await db.transaction(async (trx) => {
      if (!order.user_id) {
        logger.error("organizer_order_does_not_have_user_id order_uuid:", order.uuid);
        return;
      }

      if (order.state !== "processing") {
        logger.error("organizer_order_wrong_state order_uuid:", order.uuid, order.state);
        return;
      }

      //get uncached user
      const user = await selectUserById(order.user_id, false, false);

      let result: { success: boolean; error: string | null } = { success: true, error: null };

      if (user?.role === "user") {
        result = await updateUserRole(order.user_id, "organizer");
        logger.log("orgPromoteProcessOrder user_id :  user_before_role :", user.user_id, user.role);
      }

      // Mark Order as Completed
      if (result.success) {
        await trx
          .update(orders)
          .set({
            state: "completed",
          })
          .where(eq(orders.uuid, order.uuid))
          .execute();
        /* -------------------------------------------------------------------------- */
        const org_promotion_orders = await trx
          .select({ rowcount: count() })
          .from(orders)
          .where(and(eq(orders.state, "completed"), eq(orders.order_type, "promote_to_organizer")))
          .execute();
        const completed_org_promotion_count = org_promotion_orders.pop()?.rowcount;
        /* -------------------------------------------------------------------------- */
        const prefix = is_mainnet ? "" : "testnet.";

        await sendLogNotification({
          message: `<b> 🧙‍♂️ Organizer Promotion🧙‍♂️ </b>

👤user_id : <code>${user?.user_id}</code>
👤username : @${user?.username}
<a href='https://${prefix}tonviewer.com/transaction/${order.trx_hash}'>💰TRX</a>

<code>${order.total_price}</code> TON paid to become organizer
Serial Id: ${completed_org_promotion_count}
`,
          topic: "payments",
        });
      } else {
        logger.error("failed_to_promote_organizer", order.user_id, result.error);
      }
    });
  } catch (error) {
    logger.error("orgPromoteProcessOrder_failed", error);
  }
}
