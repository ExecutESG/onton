import { pgTable, serial, bigint, varchar, numeric, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

import { affiliateLinks } from "./affiliateLinks";

/* enum for how the buyer reached us */
export const PartnershipAffiliateUserEntryEnum = pgEnum("user_entry", ["telegram", "web"]);

/* ──────────────────────────────────────────────────────────
   partnership_affiliate_purchases
   ────────────────────────────────────────────────────────── */
export const partnershipAffiliatePurchases = pgTable(
  "partnership_affiliate_purchases",
  {
    id: serial("id").primaryKey(),

    affiliateLinkId: bigint("affiliate_link_id", { mode: "number" })
      .notNull()
      .references(() => affiliateLinks.id, { onDelete: "cascade" }),

    walletAddress: varchar("wallet_address", { length: 256 }).notNull(),

    telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull(),
    telegramUserName: varchar("telegram_user_name", { length: 128 }),

    usdtAmount: numeric("usdt_amount", { precision: 18, scale: 6 }).notNull(),
    onionAmount: numeric("onion_amount", { precision: 18, scale: 6 }).notNull(),

    timeOfBought: timestamp("time_of_bought", { withTimezone: true, precision: 6 }).notNull().defaultNow(),

    userEntry: PartnershipAffiliateUserEntryEnum("user_entry").notNull(),
  },
  (t) => ({
    affiliateIdx: index("partnership_purchases_affiliate_id_idx").on(t.affiliateLinkId),
    walletIdx: index("partnership_purchases_wallet_idx").on(t.walletAddress),
    tgUserIdx: index("partnership_purchases_tg_user_idx").on(t.telegramUserId),
  })
);

export type PartnershipAffiliatePurchasesRow = InferSelectModel<typeof partnershipAffiliatePurchases>;
export type PartnershipAffiliateUserEntryType = (typeof PartnershipAffiliateUserEntryEnum.enumValues)[number];
