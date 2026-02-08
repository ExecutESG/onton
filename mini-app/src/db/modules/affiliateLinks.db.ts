import { db } from "@/db/db";
import { AffiliateItemTypeEnum, affiliateLinks, AffiliateLinksRow } from "@/db/schema/affiliateLinks";
import { and, eq, sql } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { affiliateClicksDB } from "@/db/modules/affiliateClicks.db";

// Helper to build a cache key for a single link ID
const getAffiliateLinkCacheKey = (linkHash: string) => `affiliate_link:${linkHash}`;

/**
 * Increments total_clicks using Drizzle's update API.
 * Example assumes your schema has a column "totalClicks" or "total_clicks".
 */
export const incrementAffiliateClicks = async (linkHash: string, incrementBy = 1) => {
  try {
    // Drizzle update with an SQL expression
    await db
      .update(affiliateLinks)
      .set({
        totalClicks: sql`${affiliateLinks.totalClicks} +
        ${incrementBy}`,
      })
      .where(eq(affiliateLinks.linkHash, linkHash))
      .execute();

    // Clear cache so next read is fresh
    await redisTools.deleteCache(getAffiliateLinkCacheKey(linkHash));
    logger.log(`Incremented total_clicks for link #${linkHash} by ${incrementBy}`);
  } catch (error) {
    logger.error("Error in incrementAffiliateClicks:", error);
    throw error;
  }
};

export async function getAffiliateLinkByHash(
  linkHash: string,
  increaseClick?: boolean,
  userId?: number
): Promise<AffiliateLinksRow | undefined> {
  try {
    if (increaseClick && !userId) {
      throw new Error("userId is required to increase clicks");
    }
    const cacheKey = getAffiliateLinkCacheKey(linkHash);
    const cached = await redisTools.getCache(cacheKey);
    logger.log(`Enqueuing clickjj for linkHash=${linkHash}, userId=${userId}`);
    if (cached) {
      if (increaseClick && userId) {
        await affiliateClicksDB.enqueueClick(linkHash, userId);
      }
      return cached;
    }

    const row = (await db.select().from(affiliateLinks).where(eq(affiliateLinks.linkHash, linkHash)).execute()).pop();

    if (row) {
      await redisTools.setCache(cacheKey, row, redisTools.cacheLvl.medium);
    }
    if (increaseClick && userId) {
      await affiliateClicksDB.enqueueClick(linkHash, userId);
    }
    return row;
  } catch (error) {
    logger.error("Error in getAffiliateLinkById:", error);
    throw error;
  }
}

const incrementAffiliateClicksByLinkId = async (linkId: number, incrementBy = 1) => {
  try {
    const updateResult = (
      await db
        .update(affiliateLinks)
        .set({
          totalClicks: sql`${affiliateLinks.totalClicks} +
          ${incrementBy}`,
        })
        .where(eq(affiliateLinks.id, linkId))
        .returning()
        .execute()
    ).pop();

    if (!updateResult) {
      throw new Error(`affiliate_not_exist: Link with ID ${linkId} not found`);
    }
    // Clear cache so next read is fresh
    const cacheKey = `${redisTools.cacheKeys.affiliateLinkById}${updateResult.linkHash}`;
    await redisTools.deleteCache(cacheKey);
    logger.log(`Incremented total_clicks for link #${linkId} by ${incrementBy}`);
  } catch (error) {
    logger.error("Error in incrementAffiliateClicksByLinkId:", error);
    throw error;
  }
};

/**
 * Increments total_purchase using Drizzle's update API.
 * Example assumes your schema has a column "totalPurchase" or "total_purchase".
 */
export async function incrementAffiliatePurchase(linkHash: string, incrementBy = 1) {
  try {
    await db
      .update(affiliateLinks)
      .set({
        totalPurchase: sql`${affiliateLinks.totalPurchase} +
        ${incrementBy}`,
      })
      .where(eq(affiliateLinks.linkHash, linkHash))
      .execute();

    await redisTools.deleteCache(getAffiliateLinkCacheKey(linkHash));
    logger.log(`Incremented total_purchase for link #${linkHash} by ${incrementBy}`);
  } catch (error) {
    logger.error("Error in incrementAffiliatePurchase:", error);
    throw error;
  }
}

/**
 * Finds a single affiliate link by user and item type.
 */
export const getAffiliateLinkForOnionCampaign = async (userId: number): Promise<AffiliateLinksRow | undefined> => {
  const [link] = await db
    .select()
    .from(affiliateLinks)
    .where(
      and(
        eq(affiliateLinks.itemType, "onion1-campaign"),
        eq(affiliateLinks.creatorUserId, userId),
        eq(affiliateLinks.affiliatorUserId, userId)
      )
    )
    .limit(1)
    .execute();

  return link;
};

export const getAffiliateLinkForType = async (
  userId: number,
  type: AffiliateItemTypeEnum
): Promise<AffiliateLinksRow | undefined> => {
  const [link] = await db
    .select()
    .from(affiliateLinks)
    .where(
      and(
        eq(affiliateLinks.itemType, type),
        eq(affiliateLinks.creatorUserId, userId),
        eq(affiliateLinks.affiliatorUserId, userId)
      )
    )
    .limit(1)
    .execute();

  return link;
};

export const getAffiliateLinkByType = async (itemType: AffiliateItemTypeEnum): Promise<AffiliateLinksRow[] | undefined> => {
  const link = await db.select().from(affiliateLinks).where(eq(affiliateLinks.itemType, itemType)).execute();

  return link;
};

/**
 * Creates a new affiliate link record for the onion1 campaign.
 * itemType = "onion1-campaign"
 */
export const createOnionCampaignLink = async (userId: number, linkHash: string): Promise<AffiliateLinksRow> => {
  const title = `onion1-campaign-${userId}`;

  const [inserted] = await db
    .insert(affiliateLinks)
    .values({
      itemId: 0,
      itemType: "onion1-campaign",
      creatorUserId: userId,
      affiliatorUserId: userId,
      linkHash,
      groupTitle: "onion1-campaign",
      title,
    })
    .returning()
    .execute();

  if (!inserted) {
    throw new Error(`Failed to create onion1-campaign link for userId=${userId}`);
  }

  logger.log(`Created onion1-campaign affiliate link for user #${userId}`, inserted);
  return inserted;
};

export const createAffiliateLinkByType = async (
  title: string,
  groupTitle: string,
  userId: number,
  linkHash: string,
  type: AffiliateItemTypeEnum
): Promise<AffiliateLinksRow> => {
  const [inserted] = await db
    .insert(affiliateLinks)
    .values({
      itemId: 0,
      itemType: type,
      creatorUserId: userId,
      affiliatorUserId: userId,
      linkHash,
      groupTitle: groupTitle || type,
      title,
    })
    .returning()
    .execute();

  if (!inserted) {
    throw new Error(`Failed to create ${type} link ${title} for userId=${userId}`);
  }

  logger.log(`Created onion1-campaign affiliate link ${type} link ${title}  for user #${userId}`, inserted);
  return inserted;
};

export const affiliateLinksDB = {
  getAffiliateLinkByHash,
  incrementAffiliateClicks,
  incrementAffiliatePurchase,
  incrementAffiliateClicksByLinkId,
  getAffiliateLinkForOnionCampaign,
  createOnionCampaignLink,
  getAffiliateLinkByType,
  getAffiliateLinkForType,
  createAffiliateLinkByType,
};
