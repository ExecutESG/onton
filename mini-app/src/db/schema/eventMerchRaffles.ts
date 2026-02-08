import { pgTable, serial, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { events } from "@/db/schema/events"; // 👈 points to events
import { InferSelectModel } from "drizzle-orm";

export const eventMerchRaffles = pgTable(
  "event_merch_raffles",
  {
    merchRaffleId: serial("merch_raffle_id").primaryKey(),
    merchRaffleUuid: uuid("merch_raffle_uuid").defaultRandom().notNull(),

    /* 1-to-1 link to its event (no more parent TON raffle) */
    eventId: integer("event_id")
      .references(() => events.event_id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    uuidIdx: uniqueIndex("event_merch_raffles_uuid_uq").on(t.merchRaffleUuid),
    eventIdx: uniqueIndex("event_merch_raffles_event_uq").on(t.eventId), // enforce 1-per-event
  })
);

/* handy types */
export type MerchRaffleRow = InferSelectModel<typeof eventMerchRaffles>;
