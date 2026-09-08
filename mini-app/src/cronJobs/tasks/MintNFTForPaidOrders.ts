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

export const MintNFTForPaidOrders = async (pushLockTTl: () => any) => {
  // Get Orders to be Minted
  // Mint NFT
  // Update (DB) Successful Minted Orders as Minted
  // logger.log("&&&& MintNFT &&&&");
  const results = await db
    .select()
    .from(orders)
    .where(and(eq(orders.state, "processing"), eq(orders.order_type, "nft_mint"), isNotNull(orders.event_uuid)))
    .orderBy(asc(orders.created_at))
    .limit(100)
    .execute();

  const minterWalletAddress = config?.ONTON_MINTER_WALLET as string | undefined;
  if (!minterWalletAddress) {
    logger.error("MintNFTForPaidOrders: ONTON_MINTER_WALLET not configured");
    return;
  }

  const globalMnemonic = process.env.MNEMONIC;
  if (!globalMnemonic) {
    logger.error("MintNFTForPaidOrders: MNEMONIC env variable missing");
    return;
  }

  logger.log(`MintNFTForPaidOrders: using global minter wallet ${minterWalletAddress}`);

  /* -------------------------------------------------------------------------- */
  /*                               ORDER PROCCESS                               */
  /* -------------------------------------------------------------------------- */
  for (const ordr of results) {
    await pushLockTTl();
    try {
      const event_uuid = ordr.event_uuid;

      if (!ordr.owner_address) {
        logger.error("MintNFTForPaidOrders: no owner address for order", ordr.uuid);
        await db.update(orders).set({ state: "failed", updatedBy: "mint_no_owner_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }
      try {
        Address.parse(ordr.owner_address);
      } catch {
        logger.error("MintNFTForPaidOrders: unparsable address for order", ordr.uuid, ordr.owner_address);
        await db.update(orders).set({ state: "failed", updatedBy: "mint_unparsable_address" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }

      const paymentInfo = (
        await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid!)).execute()
      ).pop();

      if (!paymentInfo) {
        logger.error("MintNFTForPaidOrders: event does not have payment info", event_uuid);
        await db.update(orders).set({ state: "failed", updatedBy: "mint_no_payment_info" }).where(eq(orders.uuid, ordr.uuid)).execute();
        continue;
      }
      if (!paymentInfo.collectionAddress) {
        logger.error("MintNFTForPaidOrders: no collection address for event", event_uuid);
        continue;
      }

      const mintLockKey = `lock:mint_nft:${event_uuid}`;
      const lockAcquired = await redisTools.acquireLock(mintLockKey, 30);
      if (!lockAcquired) {
        logger.warn(`MintNFTForPaidOrders: mint lock busy for event ${event_uuid}, skipping order ${ordr.uuid} this cycle`);
        continue;
      }

      try {
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
      // const approved_users = modules.select().from(eventRegistrants).where(
      //   and(
      //     eq(eventRegistrants.event_uuid , event_uuid),
      //     eq(eventRegistrants)
      //   )
      // )
      const nft_count_result = await db
        .select({
          count: sql`count
              (*)`.mapWith(Number),
        })
        .from(nftItems)
        .where(eq(nftItems.event_uuid, event_uuid!))
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
        continue;
      }
      logger.log(`minting_nft_${ordr.event_uuid}_${nft_index}_address_${nft_address}`);
      /* -------------------------------------------------------------------------- */
      try {
        const prefix = is_mainnet ? "" : "testnet.";
        let username = "GIFT-USER";
        if (ordr.user_id) username = (await selectUserById(ordr.user_id!))?.username || username;
        // make trx hash url encoded
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
        /* -------------------------------------------------------------------------- */
      } catch (error) {
        logger.error("MintNFTForPaid_Orders-sendLogNotification-error--:", error);
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
        logger.log(`nft_mint_order_completed_${ordr.uuid}`);
        await trx
          .insert(nftItems)
          .values({
            event_uuid: event_uuid!,
            order_uuid: ordr.uuid,
            nft_address: nft_address,
            owner: ordr.user_id,
          })
          .execute();

        logger.log(`nft_mint_nft_item_add_${ordr.user_id}_${nft_address}`);

        if (ordr.user_id) {
          // if ordr.user_id === null order is manual mint(Gift)
          await trx
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

          logger.log(`nft_mint_user_approved_${ordr.user_id}`);
        }
      });

      // await pushLockTTl();
      } finally {
        await redisTools.releaseLock(mintLockKey);
      }
    } catch (error) {
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
    }
  }
};
