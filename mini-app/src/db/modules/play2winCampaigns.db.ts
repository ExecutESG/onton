import { db } from "@/db/db";
import { and, eq, sql } from "drizzle-orm";
import { play2winCampaigns, Play2WinCampaignsRow, Play2WinCampaignType } from "@/db/schema/play2winCampaigns";

export async function getPlay2WinCampaignRow(
  userId: number,
  campaignType: Play2WinCampaignType
): Promise<Play2WinCampaignsRow | null> {
  const [row] = await db
    .select()
    .from(play2winCampaigns)
    .where(and(eq(play2winCampaigns.userId, userId), eq(play2winCampaigns.campaignType, campaignType)));
  return row ?? null;
}

/**
 * Return the total number of users in the given campaign type.
 */
export const countUsersInCampaignType = async (campaignType: Play2WinCampaignType): Promise<number> => {
  const [res] = await db
    .select({
      total: sql<number>`count
          (*)`.mapWith(Number),
    })
    .from(play2winCampaigns)
    .where(eq(play2winCampaigns.campaignType, campaignType));

  return res ? res.total : 0;
};

const play2winCampaignsDB = {
  getPlay2WinCampaignRow,
  countUsersInCampaignType,
};
export default play2winCampaignsDB;
