import { pgTable, serial, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

// Table: nft_api_keys
export const nftApiKeys = pgTable(
  "nft_api_keys",
  {
    id: serial("id").primaryKey(),
    apiKey: varchar("api_key", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => ({
    apiKeyIdx: index("nft_api_keys_api_key_idx").on(table.apiKey),
  })
);

export type NftApiKeys = InferSelectModel<typeof nftApiKeys>;
/**
 * INSERT type
 * Omit columns that:
 *   1) are auto-generated (e.g., `id`).
 *   2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 */
export type NftApiKeysInsert = Omit<InferSelectModel<typeof nftApiKeys>, "id" | "createdAt" | "updatedAt" | "isActive">; // Exclude isActive if you want to set it manually
