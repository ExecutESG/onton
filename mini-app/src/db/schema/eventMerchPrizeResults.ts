/* db/schema/eventMerchPrizeResults.ts
   ─────────────────────────────────── */
import { pgTable, serial, integer, bigint, text, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/db/schema/users";
import { eventMerchPrizes } from "@/db/schema/eventMerchPrizes";
import { eventMerchRaffles } from "@/db/schema/eventMerchRaffles";
import { InferSelectModel } from "drizzle-orm";

/* ── enum ─────────────────────────────────────────────────────────── */
export const eventMerchPrizeResultStatus = pgEnum("merch_result_status", [
  "pending",
  "awaiting_address",
  "awaiting_pickup",
  "awaiting_shipping", // shipping address provided, waiting for merch to be shipped
  "shipped",
  "delivered",
  "collected",
  "failed",
]);

export const eventMerchNotifStatus = pgEnum("merch_notif_status", [
  "waiting", // default – nothing sent yet
  "sent", // Telegram msg delivered
  "failed", // retries exhausted
]);

/* ── table ────────────────────────────────────────────────────────── */
export const eventMerchPrizeResults = pgTable(
  "event_merch_prize_results",
  {
    id: serial("id").primaryKey(),

    /* NEW: reference to the parent merch raffle (always NOT NULL) */
    merch_raffle_id: integer("merch_raffle_id")
      .references(() => eventMerchRaffles.merchRaffleId, {
        onDelete: "cascade",
      })
      .notNull(),

    /* Prize is linked *later* → nullable here */
    merch_prize_id: integer("merch_prize_id").references(() => eventMerchPrizes.merch_prize_id, { onDelete: "cascade" }),
    notif_status: eventMerchNotifStatus("notif_status").default("waiting").notNull(),
    user_id: bigint("user_id", { mode: "number" })
      .references(() => users.user_id)
      .notNull(),

    score: integer("score").notNull(),
    rank: integer("rank"),

    status: eventMerchPrizeResultStatus("status").default("pending").notNull(),

    /* shipping info (optional) */
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
    notif_sent_at: timestamp("notif_sent_at"),
    error: text("error"), // error message if notif failed
  },
  (t) => ({
    /* one spin per *raffle* & user  */
    uniqSpin: uniqueIndex("merch_spin_unique").on(t.merch_raffle_id, t.user_id),

    /* prevent the same user from being attached to a prize twice */
    prizeUserUnique: uniqueIndex("merch_prize_user_unique").on(t.merch_prize_id, t.user_id),

    prizeIdx: index("merch_results_prize_idx").on(t.merch_prize_id),
    raffleIdx: index("merch_results_raffle_idx").on(t.merch_raffle_id),
  })
);

/* ── types ────────────────────────────────────────────────────────── */
export type EventMerchPrizeResultRow = InferSelectModel<typeof eventMerchPrizeResults>;
export type EventMerchPrizeResultStatusType = (typeof eventMerchPrizeResultStatus.enumValues)[number];

/* plain insert type – we omit auto columns */
export type EventMerchPrizeResultInsert = Omit<EventMerchPrizeResultRow, "id" | "created_at" | "updated_at">;

export type EventMerchNotifStatusType = (typeof eventMerchNotifStatus.enumValues)[number];
