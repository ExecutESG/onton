import { tokenCampaignOrdersDB } from "@/db/modules/tokenCampaignOrders.db";
import { userWalletBalancesDB } from "@/db/modules/userWalletBalances.db";
import ordersDB from "@/db/modules/orders.db";
import { usersDB } from "@/db/modules/users.db";
import { getAccountBalance } from "@/services/tonCenter";
import { db } from "@/db/db";
import { PlaceOfWalletConnection } from "@/db/schema/userWalletBalances";
import { logger } from "@/server/utils/logger";

const ONE_WEEK_MS = 24 * 60 * 60 * 1000 * 7; // 1 week in ms

export async function updateAllUserWalletBalances() {
  try {
    // 1) Fetch from campaign orders
    const campaignRows = await tokenCampaignOrdersDB.getDistinctCompletedUserWallets();
    // 2) Fetch from general orders
    const generalRows = await ordersDB.getDistinctCompletedOwnerWallets();
    // 3) Fetch user wallets that do NOT appear in orders/campaign orders
    const unusedUserRows = await usersDB.getDistinctUnusedWallets();

    //
    // -- A) Process campaign orders
    //
    for (const { userId, walletAddress } of campaignRows) {
      if (!walletAddress) continue;

      const skip = await shouldSkipWalletCheck(userId, walletAddress, "campaign", ONE_WEEK_MS);
      if (skip) {
        continue;
      }

      try {
        const balance = await getAccountBalance(walletAddress);
        await userWalletBalancesDB.upsertUserWalletBalance(userId, walletAddress, balance, "campaign");
        logger.log(
          `updateAllUserWalletBalances: Updated campaign wallet ${walletAddress} (user ${userId}) with balance ${balance}`
        );
      } catch (error) {
        logger.error(`updateAllUserWalletBalances: Failed to update (campaign) balance for wallet ${walletAddress}`, error);
      }
    }

    //
    // -- B) Process general orders
    //
    for (const { userId, walletAddress, orderType } of generalRows) {
      if (!walletAddress || !userId) continue;

      const skip = await shouldSkipWalletCheck(userId, walletAddress, orderType, ONE_WEEK_MS);
      if (skip) {
        continue;
      }

      try {
        const balance = await getAccountBalance(walletAddress);
        await userWalletBalancesDB.upsertUserWalletBalance(
          userId,
          walletAddress,
          balance,
          orderType as PlaceOfWalletConnection
        );
        logger.log(
          `updateAllUserWalletBalances: Updated general wallet ${walletAddress} (user ${userId}) with balance ${balance}, orderType=${orderType}`
        );
      } catch (error) {
        logger.error(`updateAllUserWalletBalances: Failed to update (general) balance for wallet ${walletAddress}`, error);
      }
    }

    //
    // -- C) Process "just connected" user wallets
    //    (i.e. user wallets not found in either orders or campaign tables)
    //
    for (const { userId, walletAddress } of unusedUserRows) {
      if (!walletAddress || !userId) continue;

      const skip = await shouldSkipWalletCheck(userId, walletAddress, "just_connected", ONE_WEEK_MS);
      if (skip) {
        continue;
      }

      try {
        const balance = await getAccountBalance(walletAddress);
        await userWalletBalancesDB.upsertUserWalletBalance(userId, walletAddress, balance, "just_connected");
        logger.log(
          `updateAllUserWalletBalances: Updated "just_connected" wallet ${walletAddress} (user ${userId}) with balance ${balance}`
        );
      } catch (error) {
        logger.error(
          `updateAllUserWalletBalances: Failed to update (just_connected) balance for wallet ${walletAddress}`,
          error
        );
      }
    }

    logger.log("updateAllUserWalletBalances: All user wallet balances updated successfully.");
  } catch (error) {
    logger.error("updateAllUserWalletBalances: Error updating all user wallet balances:", error);
  }
}

/**
 * Helper function that returns true if we should skip checking
 * this (userId, walletAddress, placeOfConnection) based on a max age.
 */
async function shouldSkipWalletCheck(
  userId: number,
  walletAddress: string,
  placeOfConnection: PlaceOfWalletConnection,
  maxAgeMs: number
): Promise<boolean> {
  const existingBalance = await db.query.userWalletBalances.findFirst({
    where: (fields, operators) =>
      operators.and(
        operators.eq(fields.userId, userId),
        operators.eq(fields.walletAddress, walletAddress),
        operators.eq(fields.placeOfConnection, placeOfConnection)
      ),
  });

  if (!existingBalance || !existingBalance.lastCheckedAt) {
    // Not found => we haven't checked it yet
    return false;
  }

  const lastChecked = Number(existingBalance.lastCheckedAt);
  const now = Date.now();
  return now - lastChecked < maxAgeMs;
}
