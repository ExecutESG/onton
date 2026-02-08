import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { NftApiCollectionsUpdate, nftApiItems, NftApiItems, NftApiItemsInsert } from "@/db/schema/nftApiItems";
import { NftStatusEnum } from "@/db/enum";

export const nftApiItemsDB = {
  /**
   * Get item by ID
   */
  async getById(id: number): Promise<NftApiItems | undefined> {
    try {
      const [row] = await db.select().from(nftApiItems).where(eq(nftApiItems.id, id)).execute();
      return row;
    } catch (error) {
      logger.error("nftApiItemsDB: Error getting item by ID:", error);
      throw error;
    }
  },

  /**
   * Create a new item
   */
  async create(data: NftApiItemsInsert): Promise<NftApiItems> {
    try {
      const [inserted] = await db.insert(nftApiItems).values(data).returning().execute();
      logger.info("nftApiItemsDB: Inserted new NFT item:", inserted);
      return inserted;
    } catch (error) {
      logger.error("nftApiItemsDB: Error inserting item:", error);
      throw error;
    }
  },

  /**
   * Update item by ID
   */
  async updateById(id: number, data: NftApiCollectionsUpdate): Promise<NftApiItems | undefined> {
    try {
      const [updated] = await db.update(nftApiItems).set(data).where(eq(nftApiItems.id, id)).returning().execute();
      return updated;
    } catch (error) {
      logger.error("nftApiItemsDB: Error updating item by ID:", error);
      throw error;
    }
  },

  /**
   * Get all items in a specific collection
   */
  async getAllByCollectionId(collectionId: number): Promise<NftApiItems[]> {
    try {
      return await db.select().from(nftApiItems).where(eq(nftApiItems.collectionId, collectionId)).execute();
    } catch (error) {
      logger.error("nftApiItemsDB: Error getting items by collectionId:", error);
      throw error;
    }
  },
  /**
   * Get items by status
   */
  async getItemsByStatus(status: NftStatusEnum): Promise<NftApiItems[]> {
    try {
      return await db.select().from(nftApiItems).where(eq(nftApiItems.status, status)).execute();
    } catch (error) {
      logger.error("nftApiItemsDB: Error getting items by status:", error);
      throw error;
    }
  },
  /**
   * Get items by collection ID
   */
  async findAllByCollectionId(collectionId: number): Promise<NftApiItems[]> {
    try {
      return await db.select().from(nftApiItems).where(eq(nftApiItems.collectionId, collectionId)).execute();
    } catch (error) {
      logger.error("nftApiItemsDB: Error getting items by collection address:", error);
      throw error;
    }
  },
};
