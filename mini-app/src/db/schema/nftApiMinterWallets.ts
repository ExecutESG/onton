import { pgTable, serial, varchar, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

// Table: nft_api_minter_wallets
export const nftApiMinterWallets = pgTable(
  "nft_api_minter_wallets",
  {
    id: serial("id").primaryKey(),
    walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
    apiKeyId: bigint("api_key_id", { mode: "number" }).notNull(),
    friendlyName: varchar("friendly_name", { length: 255 }),
    mnemonic: varchar("mnemonic", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    walletAddressIdx: index("nft_api_minter_wallets_wallet_address_idx").on(table.walletAddress),
    apiKeyIdIdx: index("nft_api_minter_wallets_api_key_id_idx").on(table.apiKeyId),
  })
);

export type NftApiMinterWallets = InferSelectModel<typeof nftApiMinterWallets>;
/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type NftApiMinterWalletsInsert = Omit<InferSelectModel<typeof nftApiMinterWallets>, "id" | "createdAt" | "updatedAt">; // Exclude isActive if you want to set it manually
