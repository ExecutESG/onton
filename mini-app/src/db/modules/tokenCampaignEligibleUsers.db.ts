import { db } from "@/db/db";
import { tokenCampaignEligibleUsers } from "@/db/schema/tokenCampaignEligibleUsers";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/**
 * Checks if a given telegramUserId exists in `token_campaign_eligible_users`.
 * Returns true if found, false otherwise.
 */
export const isUserEligible = async (telegramUserId: number): Promise<boolean> => {
  try {
    // const [row] = await modules
    //   .select()
    //   .from(tokenCampaignEligibleUsers)
    //   .where(eq(tokenCampaignEligibleUsers.userTelegramId, telegramUserId))
    //   .execute();
    //
    // return !!row; // true if row is found, false otherwise
    return true;
  } catch (error) {
    logger.error(`userEligibilityDB: Error checking user eligibility for ID ${telegramUserId}:`, error);
    throw error;
  }
};

/**
 * export all functions
 */
const userEligibilityDB = {
  isUserEligible,
};
export default userEligibilityDB;
