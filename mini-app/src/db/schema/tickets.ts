import { bigint, index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ticketStatus } from "@/db/schema";
import { orders } from "@/db/schema/orders";
import { events } from "@/db/schema/events";
import { users } from "@/db/schema/users";
import { eventPayment } from "@/db/schema/eventPayment";
import { relations } from "drizzle-orm";

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    telegram: text("telegram"),
    company: text("company"),
    position: text("position"),
    order_uuid: uuid("order_uuid").references(() => orders.uuid),
    status: ticketStatus("status"),
    nftAddress: text("nft_address"),
    event_uuid: uuid("event_uuid").references(() => events.event_uuid),
    ticket_id: integer("event_ticket_id")
      .references(() => eventPayment.id)
      .notNull(),
    user_id: bigint("user_id", { mode: "number" }).references(() => users.user_id),
    created_at: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  (table) => {
    return {
      nameIdx: index("tickets_name_idx").on(table.name),
      telegramIdx: index("tickets_telegram_idx").on(table.telegram),
      companyIdx: index("tickets_company_idx").on(table.company),
      orderUuidIdx: index("tickets_order_uuid_idx").on(table.order_uuid),
      statusIdx: index("tickets_status_idx").on(table.status),
      nftAddressIdx: index("tickets_nft_address_idx").on(table.nftAddress),
      eventUuidIdx: index("tickets_event_uuid_idx").on(table.event_uuid),
      ticketIdIdx: index("tickets_ticket_id_idx").on(table.ticket_id),
      userIdIdx: index("tickets_user_id_idx").on(table.user_id),
      createdAtIdx: index("tickets_created_at_idx").on(table.created_at),
      updatedAtIdx: index("tickets_updated_at_idx").on(table.updatedAt),
    };
  }
);

// Relations remain unchanged
export const ticketsRelations = relations(tickets, ({ one }) => ({
  order: one(orders, {
    fields: [tickets.order_uuid],
    references: [orders.uuid],
  }),
  event: one(events, {
    fields: [tickets.event_uuid],
    references: [events.event_uuid],
  }),
  eventPayment: one(eventPayment, {
    fields: [tickets.ticket_id],
    references: [eventPayment.id],
  }),
  user: one(users, {
    fields: [tickets.user_id],
    references: [users.user_id],
  }),
}));
