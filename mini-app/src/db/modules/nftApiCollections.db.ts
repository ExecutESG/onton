import { db } from "@/db/db";
import { eq, or, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import {
  nftApiCollections,
  NftApiCollections,
  NftApiCollectionsInsert,
  NftApiCollectionsUpdate,
} from "@/db/schema/nftApiCollections";
import { NftStatusEnum } from "@/db/enum";
// import { redisTools } from "@/lib/redisTools";

export const nftApiCollectionsDB = {
  /**
   * Get by address
   */
  async getByAddress(address: string): Promise<NftApiCollections | undefined> {
    try {
      const [row] = await db
        .select()
        .from(nftApiCollections)
        .where(or(eq(nftApiCollections.address, address), eq(nftApiCollections.friendlyAddress, address)))
        .execute();
      return row;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error fetching by address:", error);
      throw error;
    }
  },
  /**
   * Get by ID
   */
  async getById(id: number): Promise<NftApiCollections | undefined> {
    try {
      const [row] = await db.select().from(nftApiCollections).where(eq(nftApiCollections.id, id)).execute();
      return row;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error fetching by ID:", error);
      throw error;
    }
  },
  /**
   * Get by status
   */
  async getByStatus(status: NftStatusEnum): Promise<NftApiCollections[]> {
    try {
      const rows = await db.select().from(nftApiCollections).where(eq(nftApiCollections.status, status)).execute();
      return rows;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error fetching by status:", error);
      throw error;
    }
  },
  /**
   * Create a new collection row
   */
  async create(data: NftApiCollectionsInsert): Promise<NftApiCollections> {
    try {
      const [inserted] = await db.insert(nftApiCollections).values(data).returning().execute();
      logger.info("nftApiCollectionsDB: Collection inserted:", inserted);
      return inserted;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error inserting:", error);
      throw error;
    }
  },

  /**
   * Update by ID
   */
  async updateById(id: number, data: NftApiCollectionsUpdate): Promise<NftApiCollections | undefined> {
    try {
      const [updated] = await db
        .update(nftApiCollections)
        .set(data)
        .where(eq(nftApiCollections.id, id))
        .returning()
        .execute();
      return updated;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error updating by ID:", error);
      throw error;
    }
  },

  /**
   * Example: increment some numeric field (like lastRegisteredIndex)
   */
  async setLastRegisteredIndex(id: number, nextIndex: number): Promise<NftApiCollections | undefined> {
    try {
      const [updated] = await db
        .update(nftApiCollections)
        .set({
          lastRegisteredIndex: nextIndex,
        })
        .where(eq(nftApiCollections.id, id))
        .returning()
        .execute();
      return updated;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error incrementing lastRegisteredIndex:", error);
      throw error;
    }
  },
  /**
   * Get all collections by apiKeyId
   */
  async getAllByApiKey(apiKeyId: number): Promise<NftApiCollections[]> {
    try {
      const rows = await db
        .select()
        .from(nftApiCollections)
        .where(eq(nftApiCollections.apiKeyId, apiKeyId))
        .orderBy(sql`${nftApiCollections.createdAt} DESC`)
        .execute();
      return rows;
    } catch (error) {
      logger.error("nftApiCollectionsDB: Error fetching by apiKeyId:", error);
      throw error;
    }
  },
};
