import { pgTable, varchar, bigint, serial, timestamp, text, index, boolean, json } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { campaignTypes } from "@/db/enum";

export interface mergedFrom {
  address?: string;
  index?: number;
  itemId?: number;
}

export interface NftAttribute extends Record<string, string | number | boolean | undefined | mergedFrom[]> {
  trait_type?: string;
  value?: string | number | boolean;
  merged_from?: mergedFrom[];
}

export interface TokenCampaignNftItemMetaData {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  content_url?: string;
  content_type?: string;
  cover_image?: string;
  social_links?: string[];
  links?: { label: string; url: string }[];
  buttons?: { label: string; uri: string }[];
  // Now an array of NftAttribute
  attributes?: NftAttribute[];
}

export const tokenCampaignNftCollections = pgTable(
  "token_campaign_nft_collections",
  {
    id: serial("id").notNull().primaryKey(),
    campaignType: campaignTypes("campaign_type").notNull(),
    probabilityWeight: bigint("probability_weight", { mode: "number" }).notNull().default(1),
    name: varchar("name", { length: 255 }),
    description: varchar("description", { length: 500 }),
    image: varchar("image", { length: 255 }),
    socialLinks: varchar("social_links", { length: 255 }),
    address: varchar("address", { length: 255 }),
    metadataUrl: varchar("metadata_url", { length: 255 }),
    itemMetaData: json("item_meta_data"),
    collectionMetaData: json("collection_meta_data"),
    salesVolume: bigint("sales_volume", { mode: "number" }).default(0),
    salesCount: bigint("sales_count", { mode: "number" }).default(0),
    lastRegisteredItemIndex: bigint("last_registered_item_index", { mode: "number" }),
    sorting: bigint("sorting", { mode: "number" }).default(0),
    isForSale: boolean("is_for_sale").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  // indexes
  (table) => ({
    addressIdx: index("address_idx").on(table.address),
    nameIdx: index("name_idx").on(table.name),
    lastRegisteredItemIndexIdx: index("last_registered_item_index_idx").on(table.lastRegisteredItemIndex),
  })
);

/**
 * SELECT type
 * Represents the shape of a row *selected* from the table.
 */
export type TokenCampaignNftCollections = InferSelectModel<typeof tokenCampaignNftCollections>;
/**
 * SELECT type secure for public API
 * remove probabilityWeight, metadataUrl, itemMetaData,address
 */
export type TokenCampaignNftCollectionsPublic = Omit<
  TokenCampaignNftCollections,
  | "probabilityWeight"
  | "metadataUrl"
  | "itemMetaData"
  | "address"
  | "updatedBy"
  | "lastRegisteredItemIndex"
  | "socialLinks"
  | "createdAt"
  | "updatedAt"
>;
/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type TokenCampaignNftCollectionsInsert = Omit<
  InferSelectModel<typeof tokenCampaignNftCollections>,
  "id" | "createdAt" | "updatedAt" | "updatedBy"
>;
