import { db } from "@/db/db";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import {
  tokenCampaignNftCollections,
  TokenCampaignNftCollections,
  TokenCampaignNftCollectionsInsert,
  TokenCampaignNftCollectionsPublic,
} from "@/db/schema/tokenCampaignNftCollections";
import { redisTools } from "@/lib/redisTools";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import { CampaignType } from "@/db/enum";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/* ------------------------------------------------------------------
   Utility functions to build Redis cache keys for each query type
------------------------------------------------------------------ */
function buildCacheKeyById(id: number): string {
  return `token_campaign_nft_collections:id:${id}`;
}

function buildCacheKeyByAddress(address: string): string {
  return `token_campaign_nft_collections:address:${address.toLowerCase()}`;
}

function buildCacheKeyByCampaignType(campaignType: string): string {
  return `token_campaign_nft_collections:campaign_type:${campaignType}`;
}

function buildCacheKeyByCampaignTypeSecure(campaignType: string): string {
  return `token_campaign_nft_collections_secure:campaign_type:${campaignType}`;
}

/* ------------------------------------------------------------------
   Core "get" methods with Redis caching
------------------------------------------------------------------ */

/**
 * Gets a row by its numeric `id` from cache or DB.
 */
export const getCollectionById = async (id: number): Promise<TokenCampaignNftCollections | undefined> => {
  try {
    // 1) Attempt to fetch from Redis
    const cacheKey = buildCacheKeyById(id);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TokenCampaignNftCollections;
    }

    // 2) If not in cache, fetch from DB
    const [row] = await db
      .select()
      .from(tokenCampaignNftCollections)
      .where(eq(tokenCampaignNftCollections.id, id))
      .execute();

    // 3) If found, cache and return
    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }

    return undefined;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error getting token_campaign_nft_collections by ID:", error);
    throw error;
  }
};

/**
 * Gets a row (if any) by its `address`.
 * Assumes address is unique in this table, or you handle collisions externally.
 */
export const getCollectionByAddress = async (address: string): Promise<TokenCampaignNftCollections | undefined> => {
  try {
    const cacheKey = buildCacheKeyByAddress(address);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TokenCampaignNftCollections;
    }

    const [row] = await db
      .select()
      .from(tokenCampaignNftCollections)
      .where(eq(tokenCampaignNftCollections.address, address))
      .execute();

    if (row) {
      await redisTools.setCache(cacheKey, JSON.stringify(row), redisTools.cacheLvl.long);
      return row;
    }

    return undefined;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error getting token_campaign_nft_collections by address:", error);
    throw error;
  }
};

/**
 * Gets **all** rows that match a given `campaignType`.
 * Caches the entire array under one key.
 */
export const getCollectionsByCampaignType = async (campaignType: CampaignType): Promise<TokenCampaignNftCollections[]> => {
  try {
    const cacheKey = buildCacheKeyByCampaignType(campaignType);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TokenCampaignNftCollections[];
    }

    const rows = await db
      .select()
      .from(tokenCampaignNftCollections)
      .where(eq(tokenCampaignNftCollections.campaignType, campaignType))
      .orderBy(asc(tokenCampaignNftCollections.sorting))
      .execute();

    // Cache the array
    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.long);

    return rows;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error getting token_campaign_nft_collections by campaignType:", error);
    throw error;
  }
};

export const getCollectionsByCampaignTypeSecure = async (
  campaignType: CampaignType
): Promise<TokenCampaignNftCollectionsPublic[]> => {
  try {
    const cacheKey = buildCacheKeyByCampaignTypeSecure(campaignType);
    const cached = await redisTools.getCache(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TokenCampaignNftCollectionsPublic[];
    }

    const rows = await db
      .select({
        id: tokenCampaignNftCollections.id,
        address: tokenCampaignNftCollections.address,
        name: tokenCampaignNftCollections.name,
        description: tokenCampaignNftCollections.description,
        image: tokenCampaignNftCollections.image,
        campaignType: tokenCampaignNftCollections.campaignType,
        salesCount: tokenCampaignNftCollections.salesCount,
        salesVolume: tokenCampaignNftCollections.salesVolume,
        isForSale: tokenCampaignNftCollections.isForSale,
        sorting: tokenCampaignNftCollections.sorting,
        collectionMetaData: tokenCampaignNftCollections.collectionMetaData,
      })
      .from(tokenCampaignNftCollections)
      .where(eq(tokenCampaignNftCollections.campaignType, campaignType))
      .orderBy(asc(tokenCampaignNftCollections.sorting))
      .execute();

    // Cache the array
    await redisTools.setCache(cacheKey, JSON.stringify(rows), redisTools.cacheLvl.long);

    return rows;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error getting token_campaign_nft_collections by campaignType:", error);
    throw error;
  }
};

/* ------------------------------------------------------------------
   Insert methods (with optional transaction usage)
------------------------------------------------------------------ */

/**
 * Insert a new row (outside of a transaction).
 * Returns the inserted record.
 */
export const addCollection = async (data: TokenCampaignNftCollectionsInsert): Promise<TokenCampaignNftCollections> => {
  try {
    // Insert the row
    const [inserted] = await db.insert(tokenCampaignNftCollections).values(data).returning().execute();

    logger.log("Collection inserted:", inserted);

    // Re-cache the newly inserted row by ID & address & campaign type
    await revalidateCache(inserted);

    return inserted;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error inserting token_campaign_nft_collections:", error);
    throw error;
  }
};

/**
 * Insert a new row inside a transaction.
 */
export const addCollectionTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  data: TokenCampaignNftCollectionsInsert
): Promise<TokenCampaignNftCollections> => {
  const [inserted] = await tx.insert(tokenCampaignNftCollections).values(data).returning().execute();

  logger.log("tokenCampaignNftCollectionsDB: Collection inserted in transaction:", inserted);

  // Revalidate cache
  await revalidateCache(inserted);

  return inserted;
};

/* ------------------------------------------------------------------
   Update methods
------------------------------------------------------------------ */

/**
 * Update a row by `id` (outside of a transaction).
 * Returns the number of rows updated.
 */
export const updateCollectionById = async (id: number, data: Partial<TokenCampaignNftCollectionsInsert>) => {
  try {
    const result = await db
      .update(tokenCampaignNftCollections)
      .set(data)
      .where(eq(tokenCampaignNftCollections.id, id))
      .returning()
      .execute();

    // If any row was updated, re-cache it
    if (result.length > 0) {
      const updatedRow = result[0];
      await revalidateCache(updatedRow);
    }

    return result.length;
  } catch (error) {
    logger.error("tokenCampaignNftCollectionsDB: Error updating token_campaign_nft_collections by ID:", error);
    throw error;
  }
};

/**
 * Update a row by `id` within a transaction.
 * Returns the updated row or undefined if none.
 */
export const updateCollectionByIdTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  id: number,
  data: Partial<TokenCampaignNftCollectionsInsert>
): Promise<TokenCampaignNftCollections | undefined> => {
  const result = await tx
    .update(tokenCampaignNftCollections)
    .set(data)
    .where(eq(tokenCampaignNftCollections.id, id))
    .returning()
    .execute();

  const updatedRow = result[0];
  if (updatedRow) {
    await revalidateCache(updatedRow);
  }

  return updatedRow;
};

/* ------------------------------------------------------------------
   Cache Invalidation / Revalidation
------------------------------------------------------------------ */

/**
 * Re-validates (updates) Redis cache keys based on
 * the row’s `id`, `address`, and `campaignType`.
 *
 * This ensures that after an insert or update,
 * subsequent GETs return the fresh data.
 */
async function revalidateCache(row: TokenCampaignNftCollections) {
  const { id, address, campaignType } = row;

  // 1) Cache by ID
  const idKey = buildCacheKeyById(id);
  await redisTools.setCache(idKey, JSON.stringify(row), redisTools.cacheLvl.long);

  // 2) Cache by address (if present)
  if (address) {
    const addressKey = buildCacheKeyByAddress(address);
    await redisTools.setCache(addressKey, JSON.stringify(row), redisTools.cacheLvl.long);
  }

  // 3) For campaignType, we need to re-fetch *all* rows for that campaignType
  //    and re-cache the array. This is because an update/insert can add or modify
  //    a row that belongs to that campaign’s set.
  if (campaignType) {
    const campaignTypeKey = buildCacheKeyByCampaignType(campaignType);
    const campaignTypeSecureKey = buildCacheKeyByCampaignTypeSecure(campaignType);
    // Fetch all from DB
    const rows = await db
      .select()
      .from(tokenCampaignNftCollections)
      .where(eq(tokenCampaignNftCollections.campaignType, campaignType))
      .execute();

    // Store the updated list
    await redisTools.setCache(campaignTypeKey, JSON.stringify(rows), redisTools.cacheLvl.long);
    await redisTools.setCache(campaignTypeSecureKey, JSON.stringify(rows), redisTools.cacheLvl.long);
  }
}

/**
 * Increments the salesCount (and salesVolume if provided) for a collection,
 * within the given transaction.
 *
 * @param tx - The Drizzle transaction context.
 * @param collectionId - The ID of the collection to update.
 * @param volumeIncrement - If > 0, we'll add it to salesVolume.
 */
export async function incrementCollectionSalesTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  collectionId: number,
  volumeIncrement = 0
): Promise<void> {
  try {
    // Build the updates. We always increment salesCount by 1.
    // If volumeIncrement > 0, we also increment salesVolume by volumeIncrement.
    const updateData: Record<string, unknown> = {
      salesCount: sql`${tokenCampaignNftCollections.salesCount} + 1`,
    };

    const result = await tx
      .update(tokenCampaignNftCollections)
      .set(updateData)
      .where(eq(tokenCampaignNftCollections.id, collectionId))
      .returning()
      .execute();
    const updatedRow = result[0];
    if (updatedRow) {
      await revalidateCache(updatedRow);
    }
    logger.log(
      `tokenCampaignNftCollectionsDB: Collection #${collectionId} salesCount incremented (volume ${volumeIncrement}).`
    );
  } catch (error) {
    logger.error(`tokenCampaignNftCollectionsDB: Error incrementing sales for collection #${collectionId}:`, error);
    throw error;
  }
}

/* ------------------------------------------------------------------
   Export a convenient object with all methods
------------------------------------------------------------------ */
export const tokenCampaignNftCollectionsDB = {
  getCollectionById,
  getCollectionByAddress,
  getCollectionsByCampaignType,
  addCollection,
  addCollectionTx,
  updateCollectionById,
  updateCollectionByIdTx,
  incrementCollectionSalesTx,
  getCollectionsByCampaignTypeSecure,
};
