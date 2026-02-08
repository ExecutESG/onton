import { pgTable, serial, integer, text, uuid, timestamp, bigint, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { events } from "@/db/schema/events";
import { raffleTokens } from "@/db/schema/raffleTokens";

/* ------------------------------ ENUMS ----------------------------------- */
export const raffleStatus = pgEnum("raffle_status", [
  "waiting_funding", // organiser hasn’t funded the wallet yet
  "funded", // wallet funded – waiting trigger
  "distributing", // batch TX in flight
  "completed", // payout done
]);

/* ------------------------- TABLE DEFINITION ----------------------------- */
export const eventRaffles = pgTable(
  "event_raffles",
  {
    raffle_id: serial("raffle_id").primaryKey(),
    raffle_uuid: uuid("raffle_uuid").notNull(), // hidden-page URL
    event_id: integer("event_id")
      .references(() => events.event_id, { onDelete: "cascade" })
      .notNull(),

    token_id: integer("token_id")
      .references(() => raffleTokens.token_id, { onDelete: "restrict" })
      .notNull()
      .default(1),

    top_n: integer("top_n").notNull().default(10),
    prize_pool_nanoton: bigint("prize_pool_nanoton", { mode: "bigint" }),
    status: raffleStatus("status").default("waiting_funding").notNull(),

    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    raffleUuidUnique: uniqueIndex("event_raffles_uuid_unique").on(t.raffle_uuid),
    eventIdx: index("event_raffles_event_idx").on(t.event_id),
  })
);

export type EventRaffleRow = InferSelectModel<typeof eventRaffles>;

export type RaffleStatusType = (typeof raffleStatus.enumValues)[number];
export type EventRaffleInsert = Omit<EventRaffleRow, "raffle_id" | "raffle_uuid" | "created_at" | "updated_at">;
