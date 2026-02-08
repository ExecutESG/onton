import { pgTable, serial, varchar, text, bigint, timestamp, json, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { NftStatusEnum, nftStatusEnum } from "../enum";

export const nftApiItems = pgTable(
  "nft_api_items",
  {
    id: serial("id").primaryKey(),

    // Link to parent collection
    collectionId: bigint("collection_id", { mode: "number" }).notNull(),

    // NFT metadata fields
    name: varchar("name", { length: 255 }),
    description: text("description"),
    image: varchar("image", { length: 255 }),
    contentUrl: varchar("content_url", { length: 255 }),
    contentType: varchar("content_type", { length: 100 }),
    buttons: json("buttons"), // array of { label, uri }
    attributes: json("attributes"), // array of { trait_type, value }

    // On-chain references
    address: varchar("address", { length: 255 }),
    friendlyAddress: varchar("friendly_address", { length: 255 }),
    nftIndex: bigint("nft_index", { mode: "number" }),
    ownerWalletAddress: varchar("owner_wallet_address", { length: 255 }),
    status: nftStatusEnum("status").notNull().default("CREATING"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    collectionIdIdx: index("nft_api_items_collection_id_idx").on(table.collectionId),
    addressIdx: index("nft_api_items_address_idx").on(table.address),
    ownerIdx: index("nft_api_items_owner_idx").on(table.ownerWalletAddress),
  })
);

export type NftApiItems = InferSelectModel<typeof nftApiItems>;
/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type NftApiItemsInsert = Omit<InferSelectModel<typeof nftApiItems>, "id" | "createdAt" | "updatedAt" | "status">; // Exclude isActive if you want to set it manually

export type NftApiCollectionsUpdate = Partial<NftApiItemsInsert> & {
  status?: NftStatusEnum; // now it matches Drizzle’s union
};
