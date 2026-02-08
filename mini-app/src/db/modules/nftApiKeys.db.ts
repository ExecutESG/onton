import { db } from "@/db/db"; // Your Drizzle DB connection
import { and, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { nftApiKeys, NftApiKeys, NftApiKeysInsert } from "@/db/schema/nftApiKeys";
// (Optionally) import Redis or other caching here
// import { redisTools } from "@/lib/redisTools";

export const nftApiKeysDB = {
  /**
   * Get one API key record by "apiKey" value.
   */
  async getByKey(apiKey: string): Promise<NftApiKeys | undefined> {
    try {
      const [row] = await db.select().from(nftApiKeys).where(eq(nftApiKeys.apiKey, apiKey)).execute();

      return row;
    } catch (error) {
      logger.error("nftApiKeysDB: Error fetching by apiKey:", error);
      throw error;
    }
  },
  /**
   * Get one API key record by "apiKey" value, ensuring it isActive = true.
   */
  async getByKeyAndActive(apiKey: string): Promise<NftApiKeys | undefined> {
    try {
      const [row] = await db
        .select()
        .from(nftApiKeys)
        .where(and(eq(nftApiKeys.apiKey, apiKey), eq(nftApiKeys.isActive, true)))
        .execute();

      return row;
    } catch (error) {
      logger.error("nftApiKeysDB: Error fetching active apiKey:", error);
      throw error;
    }
  },
  /**
   * Insert a new row.
   * Returns the inserted record.
   */
  async insertKey(data: NftApiKeysInsert): Promise<NftApiKeys> {
    try {
      const [inserted] = await db.insert(nftApiKeys).values(data).returning().execute();
      logger.info("nftApiKeysDB: Inserted new api key:", inserted);
      return inserted;
    } catch (error) {
      logger.error("nftApiKeysDB: Error inserting api key:", error);
      throw error;
    }
  },

  /**
   * Deactivate (isActive = false) by ID
   */
  async deactivateKey(id: number): Promise<boolean> {
    try {
      const result = await db.update(nftApiKeys).set({ isActive: false }).where(eq(nftApiKeys.id, id)).returning().execute();

      return result.length > 0;
    } catch (error) {
      logger.error("nftApiKeysDB: Error deactivating key:", error);
      throw error;
    }
  },
};
