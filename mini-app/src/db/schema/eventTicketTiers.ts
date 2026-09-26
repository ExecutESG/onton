import { events } from "@/db/schema/events";
import { pgTicketTypes } from "@/db/schema/eventPayment";
import { InferSelectModel, relations } from "drizzle-orm";
import { index, integer, pgTable, real, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const eventTicketTiers = pgTable(
  "event_ticket_tiers",
  {
    id: serial("id").primaryKey(),
    event_uuid: uuid("event_uuid")
      .references(() => events.event_uuid, { onDelete: "cascade" })
      .notNull(),
    tier_name: text("tier_name").notNull(),
    price: real("price").default(0).notNull(),
    capacity: integer("capacity").default(0).notNull(),
    sold_count: integer("sold_count").default(0).notNull(),
    ticket_type: pgTicketTypes("ticket_type").default("NFT").notNull(),
    description: text("description").default("").notNull(),
    sort_order: integer("sort_order").default(0).notNull(),

    created_at: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  (table) => ({
    eventUuidIdx: index("event_ticket_tiers_event_uuid_idx").on(table.event_uuid),
    sortOrderIdx: index("event_ticket_tiers_sort_order_idx").on(table.sort_order),
  })
);

export const eventTicketTiersRelations = relations(eventTicketTiers, ({ one }) => ({
  event: one(events, {
    fields: [eventTicketTiers.event_uuid],
    references: [events.event_uuid],
  }),
}));

export type EventTicketTierRow = InferSelectModel<typeof eventTicketTiers>;
