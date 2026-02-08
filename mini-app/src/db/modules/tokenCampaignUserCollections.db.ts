import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import {
  tokenCampaignUserCollections,
  TokenCampaignUserCollections,
  TokenCampaignUserCollectionsInsert,
} from "@/db/schema/tokenCampaignUserCollections";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/**
 * Insert a new row (outside a transaction).
 * Returns the inserted record or undefined if none.
 */
export const addUserCollection = async (
  data: TokenCampaignUserCollectionsInsert
): Promise<TokenCampaignUserCollections | undefined> => {
  try {
    const [inserted] = await db.insert(tokenCampaignUserCollections).values(data).returning().execute();

    if (inserted) {
      logger.log("tokenCampaignUserCollectionsDB: User collection inserted:", inserted);
      return inserted;
    }
    return undefined;
  } catch (error) {
    logger.error("tokenCampaignUserCollectionsDB: Error inserting user collection:", error);
    throw error;
  }
};

/**
 * Insert a new row within a transaction.
 * Returns the inserted record or undefined if none.
 */
export const addUserCollectionTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  data: TokenCampaignUserCollectionsInsert
): Promise<TokenCampaignUserCollections | undefined> => {
  const [inserted] = await tx.insert(tokenCampaignUserCollections).values(data).returning().execute();

  if (inserted) {
    logger.log("tokenCampaignUserCollectionsDB: User collection inserted in transaction:", inserted);
  }
  return inserted;
};

/**
 * Fetch a user collection by its primary key (id).
 * Returns a single TokenCampaignUserCollections object or undefined if not found.
 */
export const getUserCollectionById = async (id: number): Promise<TokenCampaignUserCollections | undefined> => {
  try {
    const [row] = await db
      .select()
      .from(tokenCampaignUserCollections)
      .where(eq(tokenCampaignUserCollections.id, id))
      .execute();

    return row;
  } catch (error) {
    logger.error("tokenCampaignUserCollectionsDB: Error fetching user collection by ID:", error);
    throw error;
  }
};

/**
 * Fetch all user collections belonging to a specific user.
 * Returns an array (could be empty if no records).
 */
export const getUserCollectionsByUserId = async (userId: number): Promise<TokenCampaignUserCollections[]> => {
  try {
    const rows = await db
      .select()
      .from(tokenCampaignUserCollections)
      .where(eq(tokenCampaignUserCollections.userId, userId))
      .execute();

    return rows;
  } catch (error) {
    logger.error("tokenCampaignUserCollectionsDB: Error fetching user collections by userId:", error);
    throw error;
  }
};

/**
 * Fetch all user collections that match a certain collectionId.
 * Returns an array (could be empty if no records).
 */
export const getUserCollectionsByCollectionId = async (collectionId: number): Promise<TokenCampaignUserCollections[]> => {
  try {
    const rows = await db
      .select()
      .from(tokenCampaignUserCollections)
      .where(eq(tokenCampaignUserCollections.collectionId, collectionId))
      .execute();

    return rows;
  } catch (error) {
    logger.error("tokenCampaignUserCollectionsDB: Error fetching user collections by collectionId:", error);
    throw error;
  }
};

/**
 * Update a user collection by its primary key (id) (outside a transaction).
 * Accepts a partial set of columns for update.
 * Returns the updated record or undefined if none updated.
 */
export const updateUserCollectionById = async (
  id: number,
  data: Partial<TokenCampaignUserCollectionsInsert>
): Promise<TokenCampaignUserCollections | undefined> => {
  try {
    const [updated] = await db
      .update(tokenCampaignUserCollections)
      .set(data)
      .where(eq(tokenCampaignUserCollections.id, id))
      .returning()
      .execute();

    if (updated) {
      logger.log("tokenCampaignUserCollectionsDB: User collection updated:", updated);
    }
    return updated;
  } catch (error) {
    logger.error("tokenCampaignUserCollectionsDB: Error updating user collection by ID:", error);
    throw error;
  }
};

/**
 * Update a user collection by ID within a transaction.
 * Returns the updated record or undefined if none updated.
 */
export const updateUserCollectionByIdTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  id: number,
  data: Partial<TokenCampaignUserCollectionsInsert>
): Promise<TokenCampaignUserCollections | undefined> => {
  const [updated] = await tx
    .update(tokenCampaignUserCollections)
    .set(data)
    .where(eq(tokenCampaignUserCollections.id, id))
    .returning()
    .execute();

  if (updated) {
    logger.log("tokenCampaignUserCollectionsDB: User collection updated in transaction:", updated);
  }
  return updated;
};

/**
 * Aggregate everything into a single export for convenience.
 */
export const tokenCampaignUserCollectionsDB = {
  addUserCollection,
  addUserCollectionTx,
  getUserCollectionById,
  getUserCollectionsByUserId,
  getUserCollectionsByCollectionId,
  updateUserCollectionById,
  updateUserCollectionByIdTx,
};
