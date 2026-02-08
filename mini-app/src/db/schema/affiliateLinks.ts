import { pgTable, bigint, boolean, varchar, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { InferSelectModel, sql } from "drizzle-orm";

export const affiliateItemType = pgEnum("affiliate_item_type", [
  "EVENT",
  "HOME",
  "onion1-campaign",
  "onion1-special-affiliations",
  "onton-join-task",
  "fairlaunch-partnership",
]);

export const affiliateLinks = pgTable(
  "affiliate_links",
  {
    id: bigint("id", { mode: "number" }).primaryKey().default(sql`nextval
        ('affiliate_links_id_seq'::regclass)`),
    itemId: bigint("Item_id", { mode: "number" }).notNull(),
    itemType: affiliateItemType("item_type").notNull(),
    creatorUserId: bigint("creator_user_id", { mode: "number" }).notNull(),

    // New columns
    title: varchar("title", { length: 255 }),
    groupTitle: varchar("group_title", { length: 255 }),

    linkHash: varchar("link_hash", { length: 255 }).notNull(),
    totalClicks: bigint("total_clicks", { mode: "number" }).default(0),
    totalPurchase: bigint("total_purchase", { mode: "number" }).default(0),
    active: boolean("active").notNull().default(true),
    affiliatorUserId: bigint("affiliator_user_id", { mode: "number" }).notNull(),
    createdAt: date("created_at").default(sql`now
        ()`),
    updatedAt: date("updated_at"),
  },
  (table) => {
    return {
      linkHashUnique: uniqueIndex("affiliate_links_link_hash_key").on(table.linkHash),
      itemTypeIdx: index("affiliate_links_Item_id_item_type_idx").on(table.itemId, table.itemType),
      affiliatorUserIdIdx: index("affiliate_links_affiliator_user_id_idx").on(table.affiliatorUserId),
      creatorUserIdIdx: index("affiliate_links_creator_user_id_idx").on(table.creatorUserId),
    };
  }
);

export type AffiliateLinksRow = InferSelectModel<typeof affiliateLinks>;
export type AffiliateItemTypeEnum = (typeof affiliateItemType.enumValues)[number];
