import { pgTable, serial, varchar, text, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

export const sbtCollections = pgTable(
  "sbt_collections",
  {
    id: serial("id").primaryKey(),
    eventUuid: varchar("event_uuid", { length: 255 }).notNull(),
    collectionAddress: varchar("collection_address", { length: 255 }).notNull(),
    ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
    authorityAddress: varchar("authority_address", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    image: varchar("image", { length: 500 }),
    metadataUrl: varchar("metadata_url", { length: 500 }).notNull(),
    commonContentUrl: varchar("common_content_url", { length: 500 }).default(""),
    nextItemIndex: bigint("next_item_index", { mode: "number" }).default(0).notNull(),
    totalMinted: bigint("total_minted", { mode: "number" }).default(0).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("active"), // "creating" | "active" | "paused"
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    eventUuidIdx: index("sbt_collections_event_uuid_idx").on(table.eventUuid),
    collectionAddressIdx: index("sbt_collections_address_idx").on(table.collectionAddress),
  })
);

export type SbtCollectionRow = InferSelectModel<typeof sbtCollections>;
export type SbtCollectionInsert = Omit<SbtCollectionRow, "id" | "createdAt" | "updatedAt">;
export type SbtCollectionUpdate = Partial<SbtCollectionInsert>;
