import { pgTable, bigint, text, timestamp, serial, pgEnum } from "drizzle-orm/pg-core";
// If you have a users table schema:
import { users } from "./users";
import { InferSelectModel } from "drizzle-orm";
import { campaignTypes } from "@/db/enum";

export const mergeStatusEnum = pgEnum("merge_status", [
  "not_allowed_to_merge",
  "able_to_merge",
  "waiting_for_transaction",
  "merging",
  "merged",
  "burned",
]);
export const tokenCampaignNftItems = pgTable("token_campaign_nft_items", {
  // `id` is int8 in your SQL, so use `bigint(...)`
  id: serial("id").notNull().primaryKey(),

  // int8 => `bigint` in Drizzle
  itemId: bigint("item_id", { mode: "number" }).notNull(),

  // `campaign_type` => we store as text for simplicity
  itemType: campaignTypes("item_type").notNull(),

  nftAddress: text("nft_address").notNull(),
  index: bigint("index", { mode: "number" }).notNull(),
  collectionAddress: text("collection_address").notNull(),

  // Reference to users.user_id (assuming that is also bigint)
  owner: bigint("owner", { mode: "number" })
    .references(() => users.user_id, {
      onDelete: "no action",
      onUpdate: "no action",
    })
    .notNull(),

  // Timestamps
  // Drizzle’s `timestamp` can be configured. E.g. { withTimezone: false, fsp: 6 } for "timestamp(6)"
  createdAt: timestamp("created_at", {
    withTimezone: false,
    precision: 6, // maps to "timestamp(6)"
  }).defaultNow(),
  mergeStatus: mergeStatusEnum("merge_status").notNull().default("not_allowed_to_merge"),
  mergedIntoNftAddress: text("merged_into_nft_address"),
  mergedIntoNftIndex: bigint("merged_into_nft_index", { mode: "number" }),
  burnTrxHash: text("burn_trx_hash"),
  updatedAt: timestamp("updated_at", {
    withTimezone: false,
    precision: 3,
  }),

  updatedBy: text("updated_by").notNull().default("system"),
});

/**
 * SELECT type
 * Represents the shape of a row *selected* from the table.
 */
export type TokenCampaignNftItems = InferSelectModel<typeof tokenCampaignNftItems>;

/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type TokenCampaignNftItemsInsert = Omit<
  InferSelectModel<typeof tokenCampaignNftItems>,
  "id" | "createdAt" | "updatedAt" | "updatedBy"
>;

/**
 * export type MergeStatusType
 */
export type MergeStatusType = (typeof mergeStatusEnum.enumValues)[number];
