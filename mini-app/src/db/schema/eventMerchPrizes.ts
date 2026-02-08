import { pgTable, serial, integer, text, boolean, pgEnum, timestamp, index } from "drizzle-orm/pg-core";
import { eventMerchRaffles } from "./eventMerchRaffles";
import { InferSelectModel } from "drizzle-orm";

export const eventMerchFulfilMethod = pgEnum("merch_fulfil_method", ["ship", "pickup"]);
export const eventMerchPrizeStatus = pgEnum("merch_prize_status", [
  "draft",
  "active",
  "distributing",
  "completed",
  "cancelled",
]);

export const eventMerchPrizes = pgTable(
  "event_merch_prizes",
  {
    merch_prize_id: serial("merch_prize_id").primaryKey(),
    merch_raffle_id: integer("merch_raffle_id")
      .references(() => eventMerchRaffles.merchRaffleId, {
        onDelete: "cascade",
      })
      .notNull(),

    item_name: text("item_name").notNull(),
    item_description: text("item_description"),
    image_url: text("image_url"),

    top_n: integer("top_n").notNull().default(1),

    fulfil_method: eventMerchFulfilMethod("fulfil_method").default("ship").notNull(),
    need_shipping: boolean("need_shipping").default(true).notNull(),

    status: eventMerchPrizeStatus("status").default("draft").notNull(),

    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    raffleIdx: index("merch_prizes_raffle_idx").on(t.merch_raffle_id),
  })
);

export type EventMerchPrizeRow = InferSelectModel<typeof eventMerchPrizes>;
export type EventMerchPrizeInsert = Omit<EventMerchPrizeRow, "merch_prize_id" | "created_at" | "updated_at">;
export type EventMerchFulfilMethodType = (typeof eventMerchFulfilMethod.enumValues)[number];
export type EventMerchPrizeStatusType = (typeof eventMerchPrizeStatus.enumValues)[number];
