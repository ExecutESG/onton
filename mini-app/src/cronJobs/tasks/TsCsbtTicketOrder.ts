import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { events } from "@/db/schema/events";
import { and, asc, count, eq, isNotNull, or, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { Address } from "@ton/core";
import { eventPayment } from "@/db/schema/eventPayment";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { sbtService } from "@/services/sbtService";
import { selectUserById } from "@/db/modules/users.db";
import { sendLogNotification } from "@/lib/tgBot";
import { callTonfestForOnOntonPayment } from "@/cronJobs/helper/callTonfestForOnOntonPayment";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { callPridipieForOnOntonPayment } from "@/cronJobs/helper/callPridipieForOnOntonPayment";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { is_mainnet } from "@/services/tonCenter";
import eventDB from "@/db/modules/events.db";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { eventTicketTiersDB } from "@/db/modules/eventTicketTiers.db";
import { sendOversellAdminAlert } from "@/lib/notifications/adminAlert";

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
      // Capacity check strictly BEFORE on-chain minting and side effects
      let isSoldOut = false;
      const orderClaimed = await db.transaction(async (trx) => {
        const [locked] = await trx
          .select({ uuid: orders.uuid, state: orders.state, inventory_reserved: orders.inventory_reserved, tier_id: orders.tier_id })
          .from(orders)
          .where(and(eq(orders.uuid, ordr.uuid), eq(orders.state, "processing")))
          .for("update")
          .execute();

        if (!locked) return false;

        if (!locked.inventory_reserved) {
          if (locked.tier_id) {
            const { isSoldOut: tierSoldOut } = await eventTicketTiersDB.lockAndCheckTierCapacityTrx(trx, locked.tier_id);
            if (tierSoldOut) {
              isSoldOut = true;
            } else {
              await eventTicketTiersDB.incrementTierSoldCountTrx(trx, locked.tier_id, 1);
              await trx.update(orders).set({ inventory_reserved: true, reserved_at: new Date() }).where(eq(orders.uuid, ordr.uuid)).execute();
            }
          } else if (ordr.event_uuid) {
            const [lockedEv] = await trx
              .select({ capacity: events.capacity })
              .from(events)
              .where(eq(events.event_uuid, ordr.event_uuid))
              .for("update")
              .execute();

            if (lockedEv?.capacity && lockedEv.capacity > 0) {
              const [{ count: activeTicketsCount }] = await trx
                .select({ count: sql`count(*)`.mapWith(Number) })
                .from(orders)
                .where(
                  and(
                    eq(orders.event_uuid, ordr.event_uuid),
                    or(
                      eq(orders.state, "completed"),
                      eq(orders.state, "processing"),
                      eq(orders.state, "confirming"),
                      eq(orders.state, "new")
                    ),
                    eq(orders.order_type, ordr.order_type)
                  )
                )
                .execute();

              if (activeTicketsCount >= lockedEv.capacity) {
                isSoldOut = true;
              } else {
                await trx.update(orders).set({ inventory_reserved: true, reserved_at: new Date() }).where(eq(orders.uuid, ordr.uuid)).execute();
              }
            } else {
              await trx.update(orders).set({ inventory_reserved: true, reserved_at: new Date() }).where(eq(orders.uuid, ordr.uuid)).execute();
            }
          }
        }

        if (isSoldOut) {
          logger.error(`[Oversell Guard] Capacity exceeded for legacy TSCSBT order ${ordr.uuid}. Marking failed.`);
          await trx
            .update(orders)
            .set({ state: "failed", last_error: "capacity_exceeded_refund_required", updatedAt: new Date() })
            .where(eq(orders.uuid, ordr.uuid))
            .execute();
          return false;
        }

        await trx
          .update(orders)
          .set({ updatedBy: `csbt_lock_${Date.now()}` })
          .where(eq(orders.uuid, ordr.uuid))
          .execute();

        return true;
      });

      if (isSoldOut) {
        await sendOversellAdminAlert({
          orderUuid: ordr.uuid,
          eventUuid: event_uuid || undefined,
          trxHash: ordr.trx_hash,
          reason: "capacity_exceeded_refund_required",
        });
        continue;
      }

      if (!orderClaimed) {
        logger.warn(`TsCsbtTicketOrder: order ${ordr.uuid} already processed or claimed`);
        continue;
      }

      // Option A (#1060): Skip on-chain mint for 0-price orders (e.g. 100% coupon or 0-price tier)
      const isZeroPrice = Number(ordr.total_price) <= 0;
      if (!isZeroPrice) {
        try {
          logger.log(`call sbtService.mintSbtBadge for event ${event_uuid} user ${ordr.user_id} order ${ordr.uuid}`);
          await sbtService.mintSbtBadge({
            eventUuid: event_uuid!,
            userId: ordr.user_id ?? undefined,
            walletAddress: ordr.owner_address,
            badgeTitle: `${paymentInfo.title} (SBT Ticket)`,
            badgeDescription: paymentInfo.description || `Soulbound Ticket for ${paymentInfo.title}`,
            badgeImage: paymentInfo.ticketImage || undefined,
            attributes: [
              { trait_type: "Ticket Type", value: "Soulbound Ticket" },
              { trait_type: "Price", value: `${paymentInfo.price} ${paymentToken.symbol}` },
            ],
          });
          await callTonfestForOnOntonPayment(ordr, event_uuid!!);
          await callPridipieForOnOntonPayment(ordr, event_uuid!!);
        } catch (error) {
          console.log("create_tscsbt_ticket_failed", error);
          continue;
        }
      } else {
        logger.info(`[Option A] 0-price ts_csbt_ticket order ${ordr.uuid} skips on-chain SBT mint.`);
      }

      await db.transaction(async (trx) => {
        const updateResult = (
          await trx.update(orders).set({ state: "completed", updatedAt: new Date() }).where(eq(orders.uuid, ordr.uuid)).returning().execute()
        ).pop();
        // make coupon item used
        if (ordr.coupon_id !== null) await couponItemsDB.makeCouponItemUsedTrx(trx, ordr.coupon_id, ordr.event_uuid!);
        // Increment Affiliate Purchase
        if (updateResult && updateResult.utm_source)
          await affiliateLinksDB.incrementAffiliatePurchase(updateResult.utm_source);

        if (ordr.user_id) {
          await trx
            .update(eventRegistrants)
            .set({ status: "approved", updatedAt: new Date() })
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
