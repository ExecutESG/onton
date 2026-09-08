import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { and, asc, count, eq, isNotNull, or } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { Address } from "@ton/core";
import { eventPayment } from "@/db/schema/eventPayment";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { CsbtTicket } from "@/services/rewardsService";
import { selectUserById } from "@/db/modules/users.db";
import { sendLogNotification } from "@/lib/tgBot";
import { callTonfestForOnOntonPayment } from "@/cronJobs/helper/callTonfestForOnOntonPayment";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { callPridipieForOnOntonPayment } from "@/cronJobs/helper/callPridipieForOnOntonPayment";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { is_mainnet } from "@/services/tonCenter";
import eventDB from "@/db/modules/events.db";
import eventTokensDB from "@/db/modules/eventTokens.db";

export const TsCsbtTicketOrder = async (pushLockTTl: () => any) => {
  // Get Orders to be Minted
  // Mint NFT
  // Update (DB) Successful Minted Orders as Minted
  // logger.log("&&&& MintNFT &&&&");
  // console.log('TsCsbtTicket_Order');
  const results = await db
    .select()
    .from(orders)
    .where(and(eq(orders.state, "processing"), eq(orders.order_type, "ts_csbt_ticket"), isNotNull(orders.event_uuid)))
    .orderBy(asc(orders.created_at))
    .limit(500)
    .execute();

  /* -------------------------------------------------------------------------- */
  /*                               ORDER PROCCESS                               */
  /* -------------------------------------------------------------------------- */
  for (const ordr of results) {
    if (pushLockTTl) await pushLockTTl();
    try {
      const event_uuid = ordr.event_uuid;

      if (!ordr.owner_address) {
        logger.error("TsCsbtTicketOrder: no owner address for order", ordr.uuid);
        await db.update(orders).set({ state: "failed", updatedBy: "csbt_no_owner_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }
      try {
        Address.parse(ordr.owner_address);
      } catch {
        logger.error("TsCsbtTicketOrder: unparsable address for order", ordr.uuid, ordr.owner_address);
        await db.update(orders).set({ state: "failed", updatedBy: "csbt_unparsable_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }

      const paymentInfo = (
        await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid!)).execute()
      ).pop();

      if (!paymentInfo) {
        logger.error("TsCsbtTicketOrder: event does not have payment info", event_uuid);
        await db.update(orders).set({ state: "failed", updatedBy: "csbt_no_payment_info" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }
      const paymentToken = await eventTokensDB.getTokenById(Number(paymentInfo.token_id));
      if (!paymentToken) {
        logger.error("TsCsbtTicketOrder: missing payment token configuration", event_uuid);
        await db.update(orders).set({ state: "failed", updatedBy: "csbt_missing_token_config" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }

      if (!paymentInfo.ticketActivityId) {
        logger.error(`TsCsbtTicketOrder: no ticketActivityId for event ${event_uuid}`);
        continue;
      }
      try {
        if (ordr.user_id) {
          // if ordr.user_id === null order is manual mint(Gift)
          await db
            .update(eventRegistrants)
            .set({ status: "approved" })
            .where(
              and(
                eq(eventRegistrants.event_uuid, ordr.event_uuid!),
                eq(eventRegistrants.user_id, ordr.user_id),
                or(eq(eventRegistrants.status, "pending"), eq(eventRegistrants.status, "rejected"))
              )
            )
            .execute();

          logger.log(`tscsbt_user_approved_${ordr.user_id}`);
        }
        logger.log(`call CsbtTicket for event ${event_uuid} user ${ordr.user_id} order ${ordr.uuid}`);

        await CsbtTicket(event_uuid!, ordr.user_id!);
        await callTonfestForOnOntonPayment(ordr, event_uuid!!);
        await callPridipieForOnOntonPayment(ordr, event_uuid!!);
      } catch (error) {
        console.log("create_tscsbt_ticket_failed", error);
        continue;
      }

      await db.transaction(async (trx) => {
        const updateResult = (
          await trx.update(orders).set({ state: "completed" }).where(eq(orders.uuid, ordr.uuid)).returning().execute()
        ).pop();
        // make coupon item used
        if (ordr.coupon_id !== null) await couponItemsDB.makeCouponItemUsedTrx(trx, ordr.coupon_id, ordr.event_uuid!);
        // Increment Affiliate Purchase
        if (updateResult && updateResult.utm_source)
          await affiliateLinksDB.incrementAffiliatePurchase(updateResult.utm_source);

        logger.log(`tscsbt_order_completed_${ordr.uuid}`);
      });

      try {
        let username = "GIFT-USER";
        if (ordr.user_id) username = (await selectUserById(ordr.user_id!))?.username || username;

        const [{ order_count }] = await db
          .select({ order_count: count() })
          .from(orders)
          .where(
            and(eq(orders.event_uuid, event_uuid!), eq(orders.order_type, "ts_csbt_ticket"), eq(orders.state, "completed"))
          );
        const trxHashUrl = encodeURIComponent(ordr.trx_hash || "");
        const prefix = is_mainnet ? "" : "testnet.";
        const eventData = await eventDB.fetchEventByUuid(event_uuid!);
        await sendLogNotification({
          message: `CSBT Ticket ${order_count}
<b>${eventData?.title || "Event"}</b>
<b>${paymentInfo.title}</b>
Price: ${paymentInfo.price} ${paymentToken.symbol}
👤user_id : <code>${ordr.user_id}</code>
👤username : @${username}
Trx Hash: <a href='https://${prefix}tonviewer.com/transaction/${trxHashUrl}'>🔗 TRX</a>
          `,
          topic: "ticket",
        });
        /* -------------------------------------------------------------------------- */
      } catch (error) {
        logger.error("TsCsbtTicket_Order-sendLogNotification-error--:", error);
      }
      if (pushLockTTl) await pushLockTTl();
    } catch (error) {
      logger.log(`tscsbt_mint_error , ${error}`);
    }
  }
};
