import { pgTable, serial, varchar, text, bigint, timestamp, json, index, numeric } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

// Import the enum for NFT statuses
import { claimStatusEnum, nftStatusEnum, NftStatusEnum } from "../enum";

// Shared enum for collection/NFT statuses
export const nftApiCollections = pgTable(
  "nft_api_collections",
  {
    id: serial("id").primaryKey(),

    // Links to minter wallet & API key
    minterWalletId: bigint("minter_wallet_id", { mode: "number" }).notNull(),
    apiKeyId: bigint("api_key_id", { mode: "number" }).notNull(),

    // Basic fields
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    image: varchar("image", { length: 255 }),
    coverImage: varchar("cover_image", { length: 255 }),
    socialLinks: json("social_links"), // array of URLs
    address: varchar("address", { length: 255 }),
    friendlyAddress: varchar("friendly_address", { length: 255 }),
    status: nftStatusEnum("status").notNull().default("CREATING"),
    royalties: numeric("royalties", { precision: 5, scale: 2 }), // 5% = 5.00
    lastRegisteredIndex: bigint("last_registered_index", { mode: "number" }).default(-1).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    addressIdx: index("nft_api_collections_address_idx").on(table.address),
    minterWalletIdIdx: index("nft_api_collections_minter_idx").on(table.minterWalletId),
    apiKeyIdIdx: index("nft_api_collections_apikey_idx").on(table.apiKeyId),
  })
);

export type NftApiCollections = InferSelectModel<typeof nftApiCollections>;
/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type NftApiCollectionsInsert = Omit<
  InferSelectModel<typeof nftApiCollections>,
  "id" | "createdAt" | "updatedAt" | "status"
>; // Exclude isActive if you want to set it manually

export type NftApiCollectionsUpdate = Partial<NftApiCollectionsInsert> & {
  status?: NftStatusEnum; // now it matches Drizzle’s union
};
