import { pgTable, bigint, serial, timestamp, text, index, pgEnum, boolean } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { users } from "@/db/schema/users";

export const tokenCampaignSpinType = pgEnum("spin_type", ["normal", "specific_reward", "rewarded_spin"]);
export const tokenCampaignUserSpins = pgTable(
  "token_campaign_user_spins",
  {
    id: serial("id").notNull().primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id),
    spinPackageId: bigint("spin_package_id", { mode: "number" }),
    spinIndex: bigint("spin_index", { mode: "number" }),
    nftCollectionId: bigint("nft_collection_id", { mode: "number" }),
    isMinted: boolean("is_minted").default(false),
    spinType: tokenCampaignSpinType("spin_type").default("normal"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  // indexes
  (table) => ({
    userIdIdx: index("tcus_user_id_idx").on(table.userId),
    spinPackageIdIdx: index("tcus_spin_package_id_idx").on(table.spinPackageId),
    nftCollectionIdIdx: index("tcus_nft_collection_id_idx").on(table.nftCollectionId),
  })
);

/**
 * SELECT type
 * Represents the shape of a row *selected* from the table.
 */
export type TokenCampaignUserSpins = InferSelectModel<typeof tokenCampaignUserSpins>;
/**
 * INSERT type
 * Omit columns that:
 *  1) are auto-generated (e.g., `id`).
 *  2) have default values you typically don't supply (e.g., `createdAt`, `updatedAt`).
 *  3) are not null and have no default value (e.g., `userId`).
 */
export type TokenCampaignUserSpinsInsert = Omit<
  InferSelectModel<typeof tokenCampaignUserSpins>,
  "id" | "createdAt" | "updatedAt" | "updatedBy" | "isMinted"
>;

export type TokenCampaignSpinType = (typeof tokenCampaignSpinType.enumValues)[number];
