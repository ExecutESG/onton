import { events } from "@/db/schema/events";
import { eventTokens } from "@/db/schema/eventTokens";
import { bigint, integer, numeric, pgTable, serial, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";

export const organizerPayouts = pgTable(
  "organizer_payouts",
  {
    id: serial("id").primaryKey(),
    event_uuid: uuid("event_uuid")
      .references(() => events.event_uuid, { onDelete: "restrict" })
      .notNull(),
    amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
    token_id: integer("token_id").references(() => eventTokens.token_id),
    tx_hash: text("tx_hash").notNull(),
    paid_by: bigint("paid_by", { mode: "number" }).notNull(),
    paid_at: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventUuidIdx: index("organizer_payouts_event_uuid_idx").on(table.event_uuid),
    txHashUq: uniqueIndex("organizer_payouts_tx_hash_uq").on(table.tx_hash),
  })
);

export const organizerPayoutsRelations = relations(organizerPayouts, ({ one }) => ({
  event: one(events, {
    fields: [organizerPayouts.event_uuid],
    references: [events.event_uuid],
  }),
  token: one(eventTokens, {
    fields: [organizerPayouts.token_id],
    references: [eventTokens.token_id],
  }),
}));

export type OrganizerPayoutRow = InferSelectModel<typeof organizerPayouts>;
export type NewOrganizerPayout = InferInsertModel<typeof organizerPayouts>;
