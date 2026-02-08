import { db } from "@/db/db";
import { and, eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { nftApiMinterWallets, NftApiMinterWallets, NftApiMinterWalletsInsert } from "@/db/schema/nftApiMinterWallets";

export const nftApiMinterWalletsDB = {
  /**
   * Find all wallets for a given apiKeyId
   */
  async findByApiKey(apiKeyId: number): Promise<NftApiMinterWallets[]> {
    try {
      return await db.select().from(nftApiMinterWallets).where(eq(nftApiMinterWallets.apiKeyId, apiKeyId)).execute();
    } catch (error) {
      logger.error("nftApiMinterWalletsDB: Error fetching wallets by apiKeyId:", error);
      throw error;
    }
  },
  /**
   * Find a wallet row by walletAddress + apiKeyId
   */
  async findByAddress(apiKeyId: number, walletAddress: string): Promise<NftApiMinterWallets | undefined> {
    try {
      const [row] = await db
        .select()
        .from(nftApiMinterWallets)
        .where(and(eq(nftApiMinterWallets.apiKeyId, apiKeyId), eq(nftApiMinterWallets.walletAddress, walletAddress)))
        .execute();

      return row;
    } catch (err) {
      logger.error("nftApiMinterWalletsDB: Error in findByAddress:", err);
      throw err;
    }
  },
  /**
   * Find a wallet row by id
   */
  async findById(id: number): Promise<NftApiMinterWallets | undefined> {
    try {
      const [row] = await db.select().from(nftApiMinterWallets).where(eq(nftApiMinterWallets.id, id)).execute();
      return row;
    } catch (error) {
      logger.error("nftApiMinterWalletsDB: Error fetching by ID:", error);
      throw error;
    }
  },
  /**
   * Insert a new minter wallet row.
   */
  async insertWallet(data: NftApiMinterWalletsInsert): Promise<NftApiMinterWallets> {
    try {
      const [inserted] = await db.insert(nftApiMinterWallets).values(data).returning().execute();
      logger.info("nftApiMinterWalletsDB: Inserted wallet:", inserted);
      return inserted;
    } catch (error) {
      logger.error("nftApiMinterWalletsDB: Error inserting wallet:", error);
      throw error;
    }
  },
};
