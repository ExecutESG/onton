import {
  pgTable,
  serial,
  bigint,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
  uniqueIndex,
  text,
} from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

import { users } from "@/db/schema";
import { walletTypeEnum } from "../enum";

/* -------------------------------------------------------------------------- */
/*  Records a *finished* ONION-airdrop claim                                  */
/* -------------------------------------------------------------------------- */

export const tokenCampaignClaimOnion = pgTable(
  "token_campaign_claim_onion",
  {
    id: serial("id").primaryKey(),

    /* who & where */
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, { onDelete: "cascade" }),

    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    walletType: walletTypeEnum("wallet_type").notNull(), // primary | secondary
    tonProof: text("ton_proof"), // signed payload that proved ownership

    /* snapshot used to calculate this claim (for audit) */
    snapshotRuntime: timestamp("snapshot_runtime", { withTimezone: true }).notNull(),

    /* NFT counts at that snapshot */
    platinumNftCount: integer("platinum_nft_count").default(0),
    goldNftCount: integer("gold_nft_count").default(0),
    silverNftCount: integer("silver_nft_count").default(0),
    bronzeNftCount: integer("bronze_nft_count").default(0),

    /* ONION allocation break-down */
    onionsFromPlatinum: numeric("onions_from_platinum", { precision: 20, scale: 6 }).default("0"),
    onionsFromGold: numeric("onions_from_gold", { precision: 20, scale: 6 }).default("0"),
    onionsFromSilver: numeric("onions_from_silver", { precision: 20, scale: 6 }).default("0"),
    onionsFromBronze: numeric("onions_from_bronze", { precision: 20, scale: 6 }).default("0"),
    onionsFromScore: numeric("onions_from_score", { precision: 20, scale: 6 }).default("0"),
    onionsFromPartnership: numeric("onions_from_partnership", { precision: 20, scale: 6 }).default("0"),
    totalOnions: numeric("total_onions", { precision: 20, scale: 6 }).notNull(),
    /* bookkeeping */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    txHash: varchar("tx_hash", { length: 128 }), // optional: on-chain transfer hash
  },
  (t) => ({
    walletUnique: uniqueIndex("claim_wallet_unique").on(t.walletAddress),
    userIdx: index("claim_user_idx").on(t.userId),
  })
);

export type TokenCampaignClaimOnionRow = InferSelectModel<typeof tokenCampaignClaimOnion>;
export type TokenCampaignClaimOnionInsert = Omit<
  TokenCampaignClaimOnionRow,
  "id" | "createdAt" | "txHash" | "onionsFromPartnership"
>;
