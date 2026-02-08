import { db } from "@/db/db";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { tokenCampaignOrdersDB } from "@/db/modules/tokenCampaignOrders.db";
import { tokenCampaignUserSpinsDB } from "@/db/modules/tokenCampaignUserSpins.db";
import { logger } from "@/server/utils/logger";
import { AffiliateItemTypeEnum } from "@/db/schema/affiliateLinks";
import { TokenCampaignUserSpinsInsert } from "@/db/schema/tokenCampaignUserSpins";
import { notifyUserOfAffiliateReward } from "../helper/notifyUserOfAffiliateReward";
import { sendLogNotification } from "@/lib/tgBot";
import { usersDB } from "@/db/modules/users.db";

/**
 * Cron job: awarding spins for onion1-campaign affiliates
 */
export async function processCampaignAffiliateSpins() {
  const currentCampaign: AffiliateItemTypeEnum = "onion1-campaign";
  const goldenCollectionForReward = 1;
  const countSpinsForGoldenReward = 20;
  const countSpinsForSpinReward = 5;
  try {
    // 1) fetch links
    const onionLinks = await affiliateLinksDB.getAffiliateLinkByType(currentCampaign);

    if (onionLinks && onionLinks.length !== 0) {
      for (const link of onionLinks) {
        const totalPurchasedSpins = await tokenCampaignOrdersDB.sumSpinCountByAffiliateHash(link.linkHash);
        const User = await usersDB.selectUserById(link.affiliatorUserId);

        const previouslyAwarded = link.totalPurchase || 0;

        if (totalPurchasedSpins > previouslyAwarded) {
          logger.log(
            `processCampaignAffiliateSpins: Found ${onionLinks.length} affiliate links for campaign ${currentCampaign} for user #${User?.username} (${link.affiliatorUserId})`
          );
          await db.transaction(async (tx) => {
            const newSpinsRows: TokenCampaignUserSpinsInsert[] = [];

            // for i in range (previouslyAwarded+1 ... totalPurchasedSpins)
            for (let i = previouslyAwarded + 1; i <= totalPurchasedSpins; i++) {
              // If multiple of countSpinsForGoldenReward => only specific_reward
              if (i % countSpinsForGoldenReward === 0) {
                newSpinsRows.push({
                  userId: link.affiliatorUserId,
                  spinType: "specific_reward",
                  spinPackageId: -1,
                  spinIndex: 1,
                  nftCollectionId: goldenCollectionForReward,
                });
                logger.log(`processCampaignAffiliateSpins: Awarding specific_reward to user #${link.affiliatorUserId}`);
                // after push, also notify
                await notifyUserOfAffiliateReward(link.affiliatorUserId, "specific_reward");
                logger.log(`processCampaignAffiliateSpins: Notified user #${link.affiliatorUserId} of specific_reward`);
                try {
                  await sendLogNotification({
                    message:
                      `🥇 Campaign User Reach Golden Collection 🥇\n` +
                      `user : @${User?.username}\n` +
                      `userId : ${User?.user_id}\n` +
                      `total purchased spins by user affiliate link : ${totalPurchasedSpins}\n` +
                      `total affiliate golden reward : ${totalPurchasedSpins / countSpinsForGoldenReward}\n` +
                      `user affiliate link : ${link.linkHash}\n`,
                    topic: "campaign",
                  });
                } catch (e) {
                  logger.warn(
                    `processCampaignAffiliateSpins: Error sending log notification: for user ${link.affiliatorUserId}`,
                    e
                  );
                }
              }
              // else if multiple of countSpinsForSpinReward => rewarded_spin
              else if (i % countSpinsForSpinReward === 0) {
                newSpinsRows.push({
                  userId: link.affiliatorUserId,
                  spinType: "rewarded_spin",
                  spinPackageId: -1,
                  spinIndex: 1,
                  nftCollectionId: null,
                });
                logger.log(`processCampaignAffiliateSpins: Awarding rewarded_spin to user #${link.affiliatorUserId}`);
                // after push, also notify
                await notifyUserOfAffiliateReward(link.affiliatorUserId, "rewarded_spin");
                logger.log(`processCampaignAffiliateSpins: Notified user #${link.affiliatorUserId} of rewarded_spin`);
              }
            }

            // insert new spins
            if (newSpinsRows.length > 0) {
              for (const rowData of newSpinsRows) {
                await tokenCampaignUserSpinsDB.addUserSpinTx(tx, rowData);
                logger.log(`processCampaignAffiliateSpins: Added user spin for user #${rowData.userId}`);
              }
              logger.log(
                `processCampaignAffiliateSpins: Awarded ${newSpinsRows.length} new spins to user #${link.affiliatorUserId} on affiliate link #${link.id}`
              );
            }

            // update link's total
            const incrementRewarded = totalPurchasedSpins - previouslyAwarded;
            await affiliateLinksDB.incrementAffiliatePurchase(link.linkHash, incrementRewarded);
            logger.log(
              `processCampaignAffiliateSpins: Updated totalPurchase for link #${link.linkHash} by ${incrementRewarded}`
            );
          });
        }
      }
    }

    const onionSpecialLinks = await affiliateLinksDB.getAffiliateLinkByType("onion1-special-affiliations");
    ////////////////////////////  check if we need to process special links
    if (!onionSpecialLinks || onionSpecialLinks.length === 0) {
      return;
    }
    for (const link of onionSpecialLinks) {
      const totalPurchasedSpins = await tokenCampaignOrdersDB.sumSpinCountByAffiliateHash(link.linkHash);
      const User = await usersDB.selectUserById(link.affiliatorUserId);

      const previouslyAwarded = link.totalPurchase || 0;

      if (totalPurchasedSpins > previouslyAwarded) {
        logger.log(
          `processCampaignAffiliateSpinsSpecial: Found ${onionSpecialLinks.length} affiliate links for campaign ${currentCampaign} for user #${User?.username} (${link.affiliatorUserId})`
        );

        // update link's total
        const incrementRewarded = totalPurchasedSpins - previouslyAwarded;
        await affiliateLinksDB.incrementAffiliatePurchase(link.linkHash, incrementRewarded);
        logger.log(
          `processCampaignAffiliateSpinsSpecial: Updated totalPurchase for link #${link.linkHash} by ${incrementRewarded}`
        );
      }
    }
  } catch (error) {
    logger.error("processCampaignAffiliateSpinsSpecial: Error in processAffiliateSpins:", error);
  }
}
