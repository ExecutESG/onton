import { pgTable, timestamp, varchar, integer, serial, uniqueIndex, numeric, text } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { claimStatusEnum } from "@/db/enum";

/* -------------------------------------------------------------------------- */
/*  NFT-collection owner snapshots                                            */
/* -------------------------------------------------------------------------- */

export const snapshotCollections = pgTable(
  "nft_collection_snapshot",
  {
    id: serial("id").primaryKey(),

    snapshotRuntime: timestamp("snapshot_runtime", { withTimezone: true }).notNull(),

    collectionAddress: varchar("collection_address", { length: 66 }).notNull(),
    nftAddress: varchar("nft_address", { length: 66 }).notNull(),
    ownerAddress: varchar("owner_address", { length: 66 }).notNull(),
    claimStatus: claimStatusEnum("claim_status").default("not_claimed").notNull(),
    nftIndex: integer("nft_index").notNull(),
    ownerBalance: numeric("owner_balance", { precision: 30, scale: 9 }).notNull(), // TON balance at snapshot
    metadata: text("metadata").notNull(), // raw JSON string of the NFT metadata
  },
  (t) => ({
    snapshotUnique: uniqueIndex("snapshot_runtime_nft_idx").on(t.snapshotRuntime, t.nftAddress),
  })
);

export type SnapshotCollectionRow = InferSelectModel<typeof snapshotCollections>;
export type SnapshotCollectionInsert = Omit<SnapshotCollectionRow, "id">;
