import { db } from "@/db/db";
import { tokenCampaignOrdersDB } from "@/db/modules/tokenCampaignOrders.db";
import { tokenCampaignUserSpinsDB } from "@/db/modules/tokenCampaignUserSpins.db";
import { TokenCampaignOrdersStatus } from "@/db/schema/tokenCampaignOrders";
import { logger } from "@/server/utils/logger";
import { sendLogNotification } from "@/lib/tgBot";
import { usersDB } from "@/db/modules/users.db";
import { tokenCampaignSpinPackagesDB } from "@/db/modules/tokenCampaignSpinPackages.db";
import { is_mainnet } from "@/services/tonCenter";
import { attemptSendTelegramWithRetries } from "@/cronJobs/helper/attemptSendTelegramWithRetries";

/**
 * Cron job that checks for "confirming" orders on TON blockchain,
 * verifies payment, updates order status, and creates user spins.
 */
export async function processCampaignOrders() {
  // 1) Find all orders that have status = "confirming"
  const pendingOrders = await tokenCampaignOrdersDB.getOrdersByStatus("processing");

  for (const order of pendingOrders) {
    // Wrap updates + spin creation in a transaction
    const User = await usersDB.selectUserById(order.userId);
    const spinPackage = await tokenCampaignSpinPackagesDB.getSpinPackageById(order.spinPackageId);
    if (!spinPackage) {
      logger.error("processCampaignOrders: Spin package not found for order:", order.id);
      return;
    }
    if (!User) {
      logger.error("processCampaignOrders: User not found for order:", order.id);
      return;
    }
    await db.transaction(async (tx) => {
      // 3a) Mark the order as "processing"
      logger.info("processCampaignOrders: Processing order:", order.id);
      await tokenCampaignOrdersDB.updateOrderByIdTx(tx, order.id, {
        status: "processing" as TokenCampaignOrdersStatus,
      });

      // 4) Insert user spins for that order, e.g. spinCount times
      await tokenCampaignUserSpinsDB.addUserSpinsForOrderTx(tx, order.userId, order.spinPackageId);
      logger.info(
        `processCampaignOrders: starting  process order for user ${User?.username} with  id ${User?.user_id} for package ${spinPackage?.name} 
        with id ${spinPackage?.id} and order id ${order.id} and trxHash ${order.trxHash} and order.uuid ${order.uuid}   `
      );
      // 5) Mark the order as "completed" after successful spin insertion
      await tokenCampaignOrdersDB.updateOrderByIdTx(tx, order.id, {
        status: "completed" as TokenCampaignOrdersStatus,
      });
      // 6) Log the completion
      try {
        // make trx hash url encoded
        const trxHashUrl = encodeURIComponent(order.trxHash || "");
        const prefix = is_mainnet ? "" : "testnet.";
        await sendLogNotification({
          message:
            `💵 Campaign Order 💵 \n` +
            `Order ID: ${order.id}\n` +
            `user : @${User?.username}\n` +
            `userId : ${User?.user_id}\n` +
            `price: ${order.finalPrice} ${order.currency}\n` +
            `Trx Hash: <a href='https://${prefix}tonviewer.com/transaction/${trxHashUrl}'>🔗 TRX</a>\n` +
            `Spin Package ID: ${spinPackage?.name}\n` +
            `Transaction comment: OnionCampaign=${order.uuid}\n`,
          topic: "campaign",
        });
      } catch (e) {
        logger.warn(`processCampaignOrders: Error sending log notification: for order ${order.id}`, e);
      }
      // 7) Notify the user of the order completion
      // e.g. via Telegram or other means
      try {
        const messageText =
          `Your order has been successfully processed! 🎉\n` +
          `Your order ID is ${order.id}.\n` +
          `You have bought ${spinPackage?.name} Package.\n` +
          `Thank you for your support!`;
        const response = await attemptSendTelegramWithRetries(
          {
            telegramUserId: order.userId.toString(),
            rewardLink: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_campaign`,
            buttonText: "Check Your Spin Now",
          },
          messageText
        );
        if (!response) {
          logger.warn(`processCampaignOrders:  Failed to send order completion notification to ${order.userId}`);
        }
      } catch (e) {
        logger.warn(`processCampaignOrders: Error notifying user of order completion: for order ${order.id}`, e);
      }
      logger.log(
        `processCampaignOrders: Order completed: order.id ${order.id} and order.uuid ${order.uuid} for user ${User?.username} 
        with id ${User?.user_id} and spin package ${spinPackage?.name} with id ${spinPackage?.id}`
      );
    });
  }
}
