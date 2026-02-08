/* db/schema/eventMerchRaffleResults.ts
   ─────────────────────────────────────────────────────────────── */
import { pgTable, serial, integer, bigint, text, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { eventMerchRaffles } from "@/db/schema/eventMerchRaffles";

/* ------------- ENUM ---------------------------------------------------- */
export const merchResultStatus = pgEnum("merch_result_status", [
  "pending", // waiting for main raffle to finish
  "awaiting_address", // winner must submit shipping details
  "awaiting_pickup", // waiting for IRL collection
  "shipped",
  "delivered",
  "collected",
  "failed",
]);

/* ------------- TABLE --------------------------------------------------- */
export const eventMerchRaffleResults = pgTable(
  "event_merch_raffle_results",
  {
    id: serial("id").primaryKey(),

    merch_raffle_id: integer("merch_raffle_id")
      .references(() => eventMerchRaffles.merchRaffleId, { onDelete: "cascade" })
      .notNull(),
    user_id: bigint("user_id", { mode: "number" })
      .references(() => users.user_id)
      .notNull(),

    /* copied metrics so joins with TON results are trivial */
    score: integer("score").notNull(),
    rank: integer("rank"),

    status: merchResultStatus("status").default("pending").notNull(),

    /* fulfilment data (all optional – only for shipping) */
    full_name: text("full_name"),
    shipping_address: text("shipping_address"),
    zip_code: text("zip_code"),
    phone: text("phone"),
    tracking_number: text("tracking_number"),
    shipped_at: timestamp("shipped_at"),
    delivered_at: timestamp("delivered_at"),
    collected_at: timestamp("collected_at"),

    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    merchUserUnique: uniqueIndex("event_merch_raffle_results_unique").on(t.merch_raffle_id, t.user_id),
    merchIdx: index("event_merch_raffle_results_merch_idx").on(t.merch_raffle_id),
    statusIdx: index("event_merch_raffle_results_status_idx").on(t.status),
  })
);

export type EventMerchRaffleResultRow = InferSelectModel<typeof eventMerchRaffleResults>;
export type MerchResultStatusType = (typeof merchResultStatus.enumValues)[number];
