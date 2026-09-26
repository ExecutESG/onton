import { db } from "@/db/db";
import { orders } from "@/db/schema/orders";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { Address } from "@ton/core";
import { eventPayment } from "@/db/schema/eventPayment";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { nftItems } from "@/db/schema/nft_items";
import { mintNFT } from "@/lib/nft";
import { is_mainnet } from "@/services/tonCenter";
import { selectUserById } from "@/db/modules/users.db";
import { sendLogNotification } from "@/lib/tgBot";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { config } from "@/server/config";
import { isAxiosError } from "axios";
import { redisTools } from "@/lib/redisTools";

export const MAX_MINT_RETRIES = 5;

export const recordOrderMintFailure = async (
  orderUuid: string,
  currentRetryCount: number,
  errorMessage: string
) => {
  const nextRetries = (currentRetryCount || 0) + 1;
  const isDlq = nextRetries >= MAX_MINT_RETRIES;
  const nextState = isDlq ? "failed" : "processing";
  const updatedBy = isDlq ? "mint_dlq_max_retries" : `mint_retry_${nextRetries}`;

  await db
    .update(orders)
    .set({
      state: nextState,
      retry_count: nextRetries,
      last_error: errorMessage.slice(0, 1000),
      updatedBy,
    })
    .where(eq(orders.uuid, orderUuid))
    .execute();

  if (isDlq) {
    logger.error(
      `[DLQ ALERT] Order ${orderUuid} exceeded max mint retries (${MAX_MINT_RETRIES}). Transitioned to 'failed'. Last error: ${errorMessage}`
    );
  } else {
    logger.warn(
      `MintNFTForPaidOrders: Order ${orderUuid} mint attempt ${nextRetries}/${MAX_MINT_RETRIES} failed: ${errorMessage}`
    );
  }
};

/**
 * Process and fulfill a single paid order immediately (used by RabbitMQ consumer and cron runner).
 * Thread-safe with Redis lock per event and PostgreSQL FOR UPDATE row lock.
 */
export const processSinglePaidOrder = async (orderUuid: string): Promise<boolean> => {
  const [ordr] = await db
    .select()
    .from(orders)
    .where(eq(orders.uuid, orderUuid))
    .execute();

  if (!ordr) {
    logger.warn(`processSinglePaidOrder: order ${orderUuid} not found`);
    return false;
  }

  if (ordr.state === "completed") {
    logger.log(`processSinglePaidOrder: order ${orderUuid} already completed`);
    return true;
  }

  if (ordr.state !== "processing") {
    logger.warn(`processSinglePaidOrder: order ${orderUuid} state is '${ordr.state}', skipping`);
    return false;
  }

  if (ordr.order_type !== "nft_mint") {
    logger.log(`processSinglePaidOrder: order ${orderUuid} is type '${ordr.order_type}', not nft_mint`);
    return false;
  }

  if (ordr.retry_count >= MAX_MINT_RETRIES) {
    logger.warn(`processSinglePaidOrder: order ${orderUuid} exceeded MAX_MINT_RETRIES`);
    return false;
  }

  const minterWalletAddress = config?.ONTON_MINTER_WALLET as string | undefined;
  if (!minterWalletAddress) {
    logger.error("processSinglePaidOrder: ONTON_MINTER_WALLET not configured");
    return false;
  }

  const globalMnemonic = process.env.MNEMONIC;
  if (!globalMnemonic) {
    logger.error("processSinglePaidOrder: MNEMONIC env variable missing");
    return false;
  }

  const event_uuid = ordr.event_uuid;
  if (!event_uuid) {
    logger.error("processSinglePaidOrder: order has no event_uuid", ordr.uuid);
    return false;
  }

  if (!ordr.owner_address) {
    logger.error("processSinglePaidOrder: no owner address for order", ordr.uuid);
    await db.update(orders).set({ state: "failed", updatedBy: "mint_no_owner_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
    return false;
  }

  try {
    Address.parse(ordr.owner_address);
  } catch {
    logger.error("processSinglePaidOrder: unparsable address for order", ordr.uuid, ordr.owner_address);
    await db.update(orders).set({ state: "failed", updatedBy: "mint_unparsable_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
    return false;
  }

  const paymentInfo = (
    await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid)).execute()
  ).pop();

  if (!paymentInfo) {
    logger.error("processSinglePaidOrder: event does not have payment info", event_uuid);
    await db.update(orders).set({ state: "failed", updatedBy: "mint_no_payment_info" }).where(eq(orders.uuid, ordr.uuid)).execute();
    return false;
  }

  if (!paymentInfo.collectionAddress) {
    logger.error("processSinglePaidOrder: no collection address for event", event_uuid);
    await recordOrderMintFailure(ordr.uuid, ordr.retry_count, "No collection address found for event payment");
    return false;
  }

  const mintLockKey = `lock:mint_nft:${event_uuid}`;
  const lockAcquired = await redisTools.acquireLock(mintLockKey, 120);
  if (!lockAcquired) {
    logger.warn(`processSinglePaidOrder: mint lock busy for event ${event_uuid}, skipping order ${ordr.uuid}`);
    return false;
  }

  try {
    // Concurrency protection: Verify and lock order row with FOR UPDATE
    const orderClaimed = await db.transaction(async (trx) => {
      const [locked] = await trx
        .select({ uuid: orders.uuid })
        .from(orders)
        .where(and(eq(orders.uuid, ordr.uuid), eq(orders.state, "processing")))
        .for("update")
        .execute();

      if (!locked) return false;

      await trx
        .update(orders)
        .set({ updatedBy: `mint_lock_${Date.now()}` })
        .where(eq(orders.uuid, ordr.uuid))
        .execute();

      return true;
    });

    if (!orderClaimed) {
      logger.warn(`processSinglePaidOrder: order ${ordr.uuid} already processed or claimed by another worker`);
      return false;
    }

    const meta_data_url = await uploadJsonToMinio(
      {
        name: paymentInfo.title,
        description: paymentInfo.description,
        image: paymentInfo?.ticketImage,
        attributes: {
          order_id: ordr.uuid,
          ref: ordr.utm_source || "onton",
        },
        buttons: [
          {
            label: "Join The Onton Event",
            uri: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${event_uuid}`,
          },
        ],
      },
      "ontonitem"
    );

    const nft_count_result = await db
      .select({
        count: sql`count(*)`.mapWith(Number),
      })
      .from(nftItems)
      .where(eq(nftItems.event_uuid, event_uuid))
      .execute();

    const nft_index = nft_count_result[0].count || 0;

    logger.log(`minting_nft_${ordr.event_uuid}_${nft_index}_${paymentInfo?.collectionAddress}_${meta_data_url}`);
    const nft_address = await mintNFT(
      ordr.owner_address,
      paymentInfo?.collectionAddress,
      nft_index,
      meta_data_url,
      {
        mnemonic: globalMnemonic,
        expectedMinterAddress: minterWalletAddress,
      }
    );

    if (!nft_address) {
      logger.log(`minting_nft_${ordr.event_uuid}_${nft_index}_address_miss`);
      await recordOrderMintFailure(ordr.uuid, ordr.retry_count, "NFT mint failed to return contract address");
      return false;
    }

    logger.log(`minting_nft_${ordr.event_uuid}_${nft_index}_address_${nft_address}`);

    try {
      const prefix = is_mainnet ? "" : "testnet.";
      let username = "GIFT-USER";
      if (ordr.user_id) username = (await selectUserById(ordr.user_id))?.username || username;
      const trxHashUrl = encodeURIComponent(ordr.trx_hash || "");
      await sendLogNotification({
        message: `NFT ${nft_index + 1}
<b>${paymentInfo.title}</b>
👤user_id : <code>${ordr.user_id}</code>
👤username : @${username}
<a href='https://${prefix}getgems.io/collection/${paymentInfo.collectionAddress}'>🎨Collection</a>
<a href='https://${prefix}tonviewer.com/transaction/${trxHashUrl}'>💰TRX</a>
<a href='https://${prefix}tonviewer.com/${nft_address}'>📦NFT</a>
        `,
        topic: "ticket",
      });
    } catch (notifError) {
      logger.error("processSinglePaidOrder sendLogNotification error:", notifError);
    }

    await db.transaction(async (trx) => {
      const updateResult = (
        await trx.update(orders).set({ state: "completed" }).where(eq(orders.uuid, ordr.uuid)).returning().execute()
      ).pop();

      if (ordr.coupon_id !== null) await couponItemsDB.makeCouponItemUsedTrx(trx, ordr.coupon_id, event_uuid);
      if (updateResult && updateResult.utm_source)
        await affiliateLinksDB.incrementAffiliatePurchase(updateResult.utm_source);

      logger.log(`nft_mint_order_completed_${ordr.uuid}`);
      await trx
        .insert(nftItems)
        .values({
          event_uuid: event_uuid,
          order_uuid: ordr.uuid,
          nft_address: nft_address,
          owner: ordr.user_id,
        })
        .execute();

      logger.log(`nft_mint_nft_item_add_${ordr.user_id}_${nft_address}`);

      if (ordr.user_id) {
        await trx
          .update(eventRegistrants)
          .set({ status: "approved" })
          .where(
            and(
              eq(eventRegistrants.event_uuid, event_uuid),
              eq(eventRegistrants.user_id, ordr.user_id),
              or(eq(eventRegistrants.status, "pending"), eq(eventRegistrants.status, "rejected"))
            )
          )
          .execute();

        logger.log(`nft_mint_user_approved_${ordr.user_id}`);
      }
    });

    return true;
  } catch (error: any) {
    const errorMsg = isAxiosError(error)
      ? `Axios error: ${error.message} (status: ${error.response?.status})`
      : error instanceof Error
      ? error.message
      : String(error);

    if (isAxiosError(error)) {
      logger.error("nft_mint_error", {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
        headers: error.response?.headers,
      });
    } else {
      logger.error("nft_mint_error", error);
    }

    await recordOrderMintFailure(ordr.uuid, ordr.retry_count, errorMsg);
    return false;
  } finally {
    await redisTools.releaseLock(mintLockKey);
  }
};

export const MintNFTForPaidOrders = async (pushLockTTl: () => any) => {
  const results = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.state, "processing"),
        eq(orders.order_type, "nft_mint"),
        isNotNull(orders.event_uuid),
        sql`${orders.retry_count} < ${MAX_MINT_RETRIES}`
      )
    )
    .orderBy(asc(orders.created_at))
    .limit(100)
    .execute();

  for (const ordr of results) {
    if (pushLockTTl) {
      await pushLockTTl();
    }
    await processSinglePaidOrder(ordr.uuid);
  }
};
