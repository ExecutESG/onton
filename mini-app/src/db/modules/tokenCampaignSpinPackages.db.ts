import { db } from "@/db/db";
import { and, asc, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import {
  tokenCampaignSpinPackages,
  TokenCampaignSpinPackages,
  TokenCampaignSpinPackagesInsert,
} from "@/db/schema/tokenCampaignSpinPackages";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { CampaignType } from "@/db/enum";

/**
 * Insert a new spin package (outside of a transaction).
 * Returns the inserted record or undefined if none.
 */
export const addSpinPackage = async (
  data: TokenCampaignSpinPackagesInsert
): Promise<TokenCampaignSpinPackages | undefined> => {
  try {
    const [inserted] = await db.insert(tokenCampaignSpinPackages).values(data).returning().execute();

    if (inserted) {
      logger.log("tokenCampaignSpinPackagesDB: Spin package inserted:", inserted);
      return inserted;
    }
    return undefined;
  } catch (error) {
    logger.error("tokenCampaignSpinPackagesDB: Error inserting spin package:", error);
    throw error;
  }
};

/**
 * Insert a new spin package within a transaction.
 * Returns the inserted record or undefined if none.
 */
export const addSpinPackageTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  data: TokenCampaignSpinPackagesInsert
): Promise<TokenCampaignSpinPackages | undefined> => {
  const [inserted] = await tx.insert(tokenCampaignSpinPackages).values(data).returning().execute();

  if (inserted) {
    logger.log("tokenCampaignSpinPackagesDB: Spin package inserted in transaction:", inserted);
  }
  return inserted;
};

/**
 * Fetch a spin package by primary key (id).
 * Returns a single record or undefined if not found.
 */
export const getSpinPackageById = async (id: number): Promise<TokenCampaignSpinPackages | undefined> => {
  try {
    const [row] = await db.select().from(tokenCampaignSpinPackages).where(eq(tokenCampaignSpinPackages.id, id)).execute();

    return row;
  } catch (error) {
    logger.error("tokenCampaignSpinPackagesDB: Error fetching spin package by ID:", error);
    throw error;
  }
};

/**
 * Fetch all spin packages for a given campaign type.
 * Returns an array (could be empty).
 */
export const getSpinPackagesByCampaignType = async (campaignType: CampaignType): Promise<TokenCampaignSpinPackages[]> => {
  try {
    const rows = await db
      .select()
      .from(tokenCampaignSpinPackages)
      .where(eq(tokenCampaignSpinPackages.campaignType, campaignType))
      .execute();

    return rows;
  } catch (error) {
    logger.error("tokenCampaignSpinPackagesDB: Error fetching spin packages by campaignType:", error);
    throw error;
  }
};

/**
 * Update a spin package by ID (outside a transaction).
 * Returns the updated row or undefined if none updated.
 */
export const updateSpinPackageById = async (
  id: number,
  data: Partial<TokenCampaignSpinPackagesInsert>
): Promise<TokenCampaignSpinPackages | undefined> => {
  try {
    const [updated] = await db
      .update(tokenCampaignSpinPackages)
      .set(data)
      .where(eq(tokenCampaignSpinPackages.id, id))
      .returning()
      .execute();

    if (updated) {
      logger.log("tokenCampaignSpinPackagesDB:  Spin package updated:", updated);
    }
    return updated;
  } catch (error) {
    logger.error("tokenCampaignSpinPackagesDB: Error updating spin package by ID:", error);
    throw error;
  }
};

/**
 * Update a spin package by ID within a transaction.
 * Returns the updated row or undefined if none.
 */
export const updateSpinPackageByIdTx = async (
  tx: PgTransaction<PostgresJsQueryResultHKT>,
  id: number,
  data: Partial<TokenCampaignSpinPackagesInsert>
): Promise<TokenCampaignSpinPackages | undefined> => {
  const [updated] = await tx
    .update(tokenCampaignSpinPackages)
    .set(data)
    .where(eq(tokenCampaignSpinPackages.id, id))
    .returning()
    .execute();

  if (updated) {
    logger.log("tokenCampaignSpinPackagesDB Spin package updated in transaction:", updated);
  }
  return updated;
};

/**
 * Fetch all *active* spin packages for a given campaign type.
 * Returns an array (could be empty).
 */
export const getActiveSpinPackagesByCampaignType = async (
  campaignType: CampaignType
): Promise<TokenCampaignSpinPackages[]> => {
  try {
    const rows = await db
      .select()
      .from(tokenCampaignSpinPackages)
      // Require both a matching campaignType *and* active = true
      .where(and(eq(tokenCampaignSpinPackages.campaignType, campaignType), eq(tokenCampaignSpinPackages.active, true)))
      .orderBy(asc(tokenCampaignSpinPackages.price))
      .execute();

    return rows;
  } catch (error) {
    logger.error("tokenCampaignSpinPackagesDB: Error fetching active spin packages by campaignType:", error);
    throw error;
  }
};

/**
 * Export a single object containing all methods for convenience.
 */
export const tokenCampaignSpinPackagesDB = {
  addSpinPackage,
  addSpinPackageTx,
  getSpinPackageById,
  getActiveSpinPackagesByCampaignType,
  getSpinPackagesByCampaignType,
  updateSpinPackageById,
  updateSpinPackageByIdTx,
};
