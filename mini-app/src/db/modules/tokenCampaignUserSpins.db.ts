import { db } from "@/db/db";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import {
  tokenCampaignUserSpins,
  TokenCampaignUserSpins,
  TokenCampaignUserSpinsInsert,
} from "@/db/schema/tokenCampaignUserSpins";
import { tokenCampaignSpinPackages } from "@/db/schema/tokenCampaignSpinPackages"; // needed for spinCount
import { sql } from "drizzle-orm";
import { CampaignType, tokenCampaignNftCollections } from "@/db/schema";

/* ------------------------------------------------------------------
   Insert Methods
------------------------------------------------------------------ */

/**
 * Insert a new spin (outside a transaction).
 * Returns the inserted record or undefined if none.
 */
export const addUserSpin = async (data: TokenCampaignUserSpinsInsert): Promise<TokenCampaignUserSpins | undefined> => {
  try {
    const [inserted] = await db.insert(tokenCampaignUserSpins).values(data).returning().execute();

    if (inserted) {
      logger.info("tokenCampaignUserSpinsDB: User spin inserted:", inserted);
      return inserted;
    }
    return undefined;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error inserting user spin:", error);
    throw error;
  }
};

/**
 * Insert a new spin within a transaction.
 * Returns the inserted record or undefined if none.
 */
export const addUserSpinTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: TokenCampaignUserSpinsInsert
): Promise<TokenCampaignUserSpins | undefined> => {
  const [inserted] = await tx.insert(tokenCampaignUserSpins).values(data).returning().execute();

  if (inserted) {
    logger.log("User spin inserted in transaction:", inserted);
  }
  return inserted;
};

/**
 * Adds multiple spins for a user based on a given spin package,
 * all within a single transaction.
 */
export const addUserSpinsForOrderTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number,
  spinPackageId: number
): Promise<TokenCampaignUserSpins[]> => {
  // 1) Fetch the spin package to get spinCount
  const [spinPackage] = await tx
    .select({
      id: tokenCampaignSpinPackages.id,
      spinCount: tokenCampaignSpinPackages.spinCount,
    })
    .from(tokenCampaignSpinPackages)
    .where(eq(tokenCampaignSpinPackages.id, spinPackageId))
    .execute();

  if (!spinPackage) {
    throw new Error(`Spin package ${spinPackageId} not found.`);
  }

  // 2) Count how many spins the user already has (for spinIndex offset)
  const [spinCountRow] = await tx
    .select({
      count: sql<number>`COUNT
          (*)`.mapWith(Number),
    })
    .from(tokenCampaignUserSpins)
    .where(eq(tokenCampaignUserSpins.userId, userId))
    .execute();

  const currentSpinCount = spinCountRow?.count ?? 0;

  // 3) Build an array of new spin records
  const newSpins: TokenCampaignUserSpinsInsert[] = [];
  for (let i = 0; i < spinPackage.spinCount; i++) {
    newSpins.push({
      userId,
      spinPackageId,
      spinIndex: currentSpinCount + i + 1,
      nftCollectionId: null,
      spinType: "normal",
    });
  }

  // 4) Insert them in one statement
  const inserted = await tx.insert(tokenCampaignUserSpins).values(newSpins).returning().execute();

  logger.log(
    `tokenCampaignUserSpinsDB: Inserted ${inserted.length} new spins for user #${userId}, package #${spinPackageId}.`
  );
  return inserted;
};

/* ------------------------------------------------------------------
   Get Methods
------------------------------------------------------------------ */

/**
 * Fetch a user spin by primary key (id).
 * Returns a single record or undefined if not found.
 */
export const getUserSpinById = async (id: number): Promise<TokenCampaignUserSpins | undefined> => {
  try {
    const [spin] = await db.select().from(tokenCampaignUserSpins).where(eq(tokenCampaignUserSpins.id, id)).execute();

    return spin;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching user spin by ID:", error);
    throw error;
  }
};

/**
 * Fetch all spins for a given userId.
 * Returns an array (could be empty).
 */
export const getUserSpinsByUserId = async (userId: number): Promise<TokenCampaignUserSpins[]> => {
  try {
    const spins = await db.select().from(tokenCampaignUserSpins).where(eq(tokenCampaignUserSpins.userId, userId)).execute();

    return spins;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching user spins by userId:", error);
    throw error;
  }
};

/**
 * Fetch all spins by spinPackageId.
 * Returns an array (could be empty).
 */
export const getUserSpinsBySpinPackageId = async (spinPackageId: number): Promise<TokenCampaignUserSpins[]> => {
  try {
    const spins = await db
      .select()
      .from(tokenCampaignUserSpins)
      .where(eq(tokenCampaignUserSpins.spinPackageId, spinPackageId))
      .execute();

    return spins;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching user spins by spinPackageId:", error);
    throw error;
  }
};

/**
 * Fetch all spins by nftCollectionId.
 * Returns an array (could be empty).
 */
export const getUserSpinsByNftCollectionId = async (nftCollectionId: number): Promise<TokenCampaignUserSpins[]> => {
  try {
    const spins = await db
      .select()
      .from(tokenCampaignUserSpins)
      .where(eq(tokenCampaignUserSpins.nftCollectionId, nftCollectionId))
      .execute();

    return spins;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching user spins by nftCollectionId:", error);
    throw error;
  }
};

/* ------------------------------------------------------------------
   Update Methods
------------------------------------------------------------------ */

/**
 * Update a spin by ID (outside a transaction).
 * Accepts partial data to update. Returns the updated record or undefined.
 */
export const updateUserSpinById = async (
  id: number,
  data: Partial<TokenCampaignUserSpinsInsert>
): Promise<TokenCampaignUserSpins | undefined> => {
  try {
    const [updated] = await db
      .update(tokenCampaignUserSpins)
      .set(data)
      .where(eq(tokenCampaignUserSpins.id, id))
      .returning()
      .execute();

    if (updated) {
      logger.log("tokenCampaignUserSpinsDB: User spin updated:", updated);
    }
    return updated;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error updating user spin by ID:", error);
    throw error;
  }
};

/**
 * Update a spin by ID within a transaction.
 * Accepts partial data. Returns the updated record or undefined.
 */
export const updateUserSpinByIdTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  id: number,
  data: Partial<TokenCampaignUserSpinsInsert>
): Promise<TokenCampaignUserSpins | undefined> => {
  const [updated] = await tx
    .update(tokenCampaignUserSpins)
    .set(data)
    .where(eq(tokenCampaignUserSpins.id, id))
    .returning()
    .execute();

  if (updated) {
    logger.log("tokenCampaignUserSpinsDB: User spin updated in transaction:", updated);
  }
  return updated;
};

/**
 * Fetches (and locks) one unused spin row (nftCollectionId IS NULL)
 * for a given user and spin package, within a transaction.
 * Returns the spin row or undefined if none found.
 */
export const getUnusedSpinForUserTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number
): Promise<TokenCampaignUserSpins | undefined> => {
  try {
    const [spinRow] = await tx
      .select()
      .from(tokenCampaignUserSpins)
      .where(and(eq(tokenCampaignUserSpins.userId, userId), isNull(tokenCampaignUserSpins.nftCollectionId)))
      .limit(1)
      .execute();

    return spinRow;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching unused spin row:", error);
    throw error;
  }
};

/**
 * Queries that they have joined to other tables
 */

interface CollectionWithCount {
  id: number;
  name: string | null;
  description: string | null;
  image: string | null;
  socialLinks: string | null;
  address: string | null;
  // add or remove any other columns from tokenCampaignNftCollections as needed
  count: number;
  isForSale: boolean | null;
}

/**
 * Returns *all* collections, each with a `count` of how many times
 * this user has that NFT collection. If user doesn't have it, count = 0.
 * Optionally filter by campaign type if needed.
 */
export async function getAllCollectionsWithUserCount(
  userId: number,
  campaignType?: CampaignType
): Promise<CollectionWithCount[]> {
  try {
    const whereClause = campaignType ? eq(tokenCampaignNftCollections.campaignType, campaignType) : undefined;

    // In Drizzle, we can compose a .where(...) on the main table if you want to filter by campaignType.

    // 1) Perform a SELECT starting from the token_campaign_nft_collections table
    //    Left-join to user spins matching userId
    // 2) Count how many spin entries exist for that collection + user
    // 3) Group by the collection columns to get distinct rows
    const result = await db
      .select({
        id: tokenCampaignNftCollections.id,
        name: tokenCampaignNftCollections.name,
        description: tokenCampaignNftCollections.description,
        image: tokenCampaignNftCollections.image,
        socialLinks: tokenCampaignNftCollections.socialLinks,
        address: tokenCampaignNftCollections.address,
        isForSale: tokenCampaignNftCollections.isForSale,
        // If the user has no spins, COALESCE => 0
        count: sql<number>`COALESCE
            (COUNT(${tokenCampaignUserSpins.id}), 0)`.mapWith(Number),
      })
      .from(tokenCampaignNftCollections)
      .leftJoin(
        tokenCampaignUserSpins,
        and(
          eq(tokenCampaignNftCollections.id, tokenCampaignUserSpins.nftCollectionId),
          eq(tokenCampaignUserSpins.userId, userId)
        )
      )
      .where(whereClause ? whereClause : undefined)
      .groupBy(
        tokenCampaignNftCollections.id,
        tokenCampaignNftCollections.name,
        tokenCampaignNftCollections.description,
        tokenCampaignNftCollections.image,
        tokenCampaignNftCollections.socialLinks,
        tokenCampaignNftCollections.address
      )
      .orderBy(tokenCampaignNftCollections.sorting)
      .execute();

    return result;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching all collections with user count:", error);
    throw error;
  }
}

/**
 * Returns a row for EVERY user + EVERY NFT collection (cartesian product)
 * joined with the user spins table. If no spin entry exists, count=0.
 */

export type AllUsersCollectionsCountRow = {
  userId: number;
  collectionId: number;
  name: string | null;
  description: string | null;
  image: string | null;
  socialLinks: string | null;
  address: string | null;
  count: number;
};

export async function getAllUsersCollectionsCount(): Promise<AllUsersCollectionsCountRow[]> {
  try {
    const query = sql`
        SELECT u.user_id                AS "userId",
               c.id                     AS "collectionId",
               c.name                   AS "name",
               c.description            AS "description",
               c.image                  AS "image",
               c.social_links           AS "socialLinks",
               c.address                AS "address",
               COALESCE(COUNT(s.id), 0) AS "count"
        FROM "users" u
                 CROSS JOIN "token_campaign_nft_collections" c
                 LEFT JOIN "token_campaign_user_spins" s
                           ON s."user_id" = u."user_id"
                               AND s."nft_collection_id" = c."id"
        GROUP BY u.user_id,
                 c.id,
                 c.name,
                 c.description,
                 c.image,
                 c.social_links,
                 c.address
        ORDER BY u.user_id, c.id;
    `;

    // modules.execute(...) returns a raw result. We'll map it to our TS type.
    const result = await db.execute<AllUsersCollectionsCountRow>(query);

    // Depending on the driver/config, `result.rows` may hold the data:
    const rows = result;
    return rows;
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching all user-collection counts:", error);
    throw error;
  }
}

interface SpinStats {
  used: number;
  remaining: number;
}

export const getUserSpinStats = async (userId: number, spinPackageId?: number): Promise<SpinStats> => {
  try {
    // Build the WHERE conditions
    const conditions = [eq(tokenCampaignUserSpins.userId, userId)];
    if (spinPackageId) {
      conditions.push(eq(tokenCampaignUserSpins.spinPackageId, spinPackageId));
    }

    // Single query that sums up used vs. remaining
    const [row] = await db
      .select({
        used: sql<number>`SUM
            (CASE WHEN ${tokenCampaignUserSpins.nftCollectionId} IS NOT NULL THEN 1 ELSE 0 END)`.mapWith(Number),
        remaining: sql<number>`SUM
            (CASE WHEN ${tokenCampaignUserSpins.nftCollectionId} IS NULL THEN 1 ELSE 0 END)`.mapWith(Number),
      })
      .from(tokenCampaignUserSpins)
      .where(and(...conditions))
      .execute();

    return {
      used: row?.used ?? 0,
      remaining: row?.remaining ?? 0,
    };
  } catch (error) {
    logger.error("tokenCampaignUserSpinsDB: Error fetching user spin stats:", error);
    throw error;
  }
};

/* ------------------------------------------------------------------
   Export a single object with all the methods
------------------------------------------------------------------ */

export const tokenCampaignUserSpinsDB = {
  addUserSpin,
  addUserSpinTx,
  addUserSpinsForOrderTx,
  getUserSpinById,
  getUserSpinsByUserId,
  getUserSpinsBySpinPackageId,
  getUnusedSpinForUserTx,
  getUserSpinsByNftCollectionId,
  getAllCollectionsWithUserCount,
  getAllUsersCollectionsCount,
  getUserSpinStats,
  updateUserSpinById,
  updateUserSpinByIdTx,
};
