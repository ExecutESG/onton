import { bigint, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const tokenCampaignMergeTransactionsStatus = pgEnum("status", ["pending", "processing", "completed", "failed"]);
/**
 * Drizzle schema for storing merge transactions.
 */
export const tokenCampaignMergeTransactions = pgTable("token_campaign_merge_transactions", {
  id: serial("id").primaryKey().notNull(),
  // The user's wallet or the address that triggered the merge
  walletAddress: text("wallet_address").notNull(),

  // The main transaction hash for the entire multi-message TX
  transactionHash: text("transaction_hash").notNull(),

  // The three NFT addresses that were merged
  goldNftAddress: text("gold_nft_address"),
  silverNftAddress: text("silver_nft_address"),
  bronzeNftAddress: text("bronze_nft_address"),
  platinumNftAddress: text("platinum_nft_address"),
  status: tokenCampaignMergeTransactionsStatus("status").default("pending"),
  extraData: text("extra_data"),
  user_id: bigint("user_id", { mode: "number" }),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * SELECT type
 */
export type TokenCampaignMergeTransactions = InferSelectModel<typeof tokenCampaignMergeTransactions>;

/**
 * INSERT type
 */
export type TokenCampaignMergeTransactionsInsert = InferInsertModel<typeof tokenCampaignMergeTransactions>;

export type TokenCampaignMergeTransactionsStatus = (typeof tokenCampaignMergeTransactionsStatus.enumValues)[number];
