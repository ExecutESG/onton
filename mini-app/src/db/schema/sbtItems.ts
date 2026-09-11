import { pgTable, serial, varchar, text, bigint, timestamp, json, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

export const sbtItems = pgTable(
  "sbt_items",
  {
    id: serial("id").primaryKey(),
    sbtCollectionId: bigint("sbt_collection_id", { mode: "number" }).notNull(),
    itemIndex: bigint("item_index", { mode: "number" }).notNull(),
    itemAddress: varchar("item_address", { length: 255 }).notNull(),
    recipientUserId: bigint("recipient_user_id", { mode: "number" }),
    recipientWalletAddress: varchar("recipient_wallet_address", { length: 255 }).notNull(),
    metadataUrl: varchar("metadata_url", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("minted"), // "pending" | "minting" | "minted" | "revoked" | "destroyed"
    transactionHash: varchar("transaction_hash", { length: 255 }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    metadata: json("metadata"), // cached JSON metadata { name, description, image, attributes }
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    collectionIdIdx: index("sbt_items_collection_id_idx").on(table.sbtCollectionId),
    itemAddressIdx: index("sbt_items_address_idx").on(table.itemAddress),
    recipientWalletIdx: index("sbt_items_recipient_wallet_idx").on(table.recipientWalletAddress),
    recipientUserIdx: index("sbt_items_recipient_user_idx").on(table.recipientUserId),
  })
);

export type SbtItemRow = InferSelectModel<typeof sbtItems>;
export type SbtItemInsert = Omit<SbtItemRow, "id" | "createdAt" | "updatedAt">;
export type SbtItemUpdate = Partial<SbtItemInsert>;
