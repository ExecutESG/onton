import { pgTable, serial, integer, text, bigint, timestamp, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { eventRaffles } from "@/db/schema/eventRaffles";

/* ------------------------------ ENUM ------------------------------------ */
export const eventRaffleResultStatus = pgEnum("raffle_result_status", [
  "pending",
  "eligible",
  "paid",
  "failed",
  "not_eligible",
]);

/* ------------------------- TABLE DEFINITION ----------------------------- */
export const eventRaffleResults = pgTable(
  "event_raffle_results",
  {
    id: serial("id").primaryKey(),
    raffle_id: integer("raffle_id")
      .references(() => eventRaffles.raffle_id, { onDelete: "cascade" })
      .notNull(),
    user_id: bigint("user_id", { mode: "number" })
      .references(() => users.user_id)
      .notNull(),

    score: integer("score").notNull(),
    rank: integer("rank"),
    status: eventRaffleResultStatus("status").default("pending").notNull(),

    wallet_address: text("wallet_address").notNull(),
    reward_nanoton: bigint("reward_nanoton", { mode: "bigint" }),
    tx_hash: text("tx_hash"),

    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    raffleUserUnique: uniqueIndex("event_raffle_results_unique").on(t.raffle_id, t.user_id),
    raffleIdx: index("event_raffle_results_raffle_idx").on(t.raffle_id),
    scoreIdx: index("event_raffle_results_score_idx").on(t.score),
  })
);

export type EventRaffleResultRow = InferSelectModel<typeof eventRaffleResults>;
export type eventRaffleResultStatusType = (typeof eventRaffleResultStatus.enumValues)[number];
export type EventRaffleResultInsert = Omit<EventRaffleResultRow, "id" | "created_at" | "updated_at">;
