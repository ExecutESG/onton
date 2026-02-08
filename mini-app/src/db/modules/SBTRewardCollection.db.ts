import { db } from "@/db/db";
import { sbtRewardCollections } from "@/db/schema";
import { eq, SQLWrapper } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";

interface SBTRewardCollection {
  id: number;
  hubID?: number;
  hubName?: string;
  videoLink?: string;
  imageLink?: string;
}

// Function to fetch all reward collections
export const fetchAllSBTRewardCollections = async (): Promise<SBTRewardCollection[]> => {
  const cacheKey = redisTools.cacheKeys.SBTRewardCollections;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result = await db.select().from(sbtRewardCollections).execute();

  await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);

  return result as SBTRewardCollection[];
};

// Function to fetch reward collections by hubID
export const fetchSBTRewardCollectionsByHubID = async (hubID: number): Promise<SBTRewardCollection[]> => {
  const cacheKey = `${redisTools.cacheKeys.SBTRewardCollectionByHubID}${hubID}`;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result = await db.select().from(sbtRewardCollections).where(eq(sbtRewardCollections.hubID, hubID)).execute();

  await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);

  return result as SBTRewardCollection[];
};

// Function to fetch a single reward collection by ID
export const fetchSBTRewardCollectionById = async (id: number): Promise<SBTRewardCollection | undefined> => {
  const cacheKey = `SBTRewardCollection:${id}`;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result = await db
    .select()
    .from(sbtRewardCollections)
    .where(eq(sbtRewardCollections.id, id))
    .limit(1)
    .execute()
    .then((results) => results[0]);

  if (result) {
    await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);
  }

  return result as SBTRewardCollection | undefined;
};

export const SBTRewardCollectionDB = {
  fetchAllSBTRewardCollections,
  fetchSBTRewardCollectionsByHubID,
  fetchSBTRewardCollectionById,
};
