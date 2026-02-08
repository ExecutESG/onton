import { events } from "@/db/schema/events";
import { eventTokens } from "@/db/schema/eventTokens";
import { InferSelectModel } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, real, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const organizerPaymentStatus = pgEnum("organizer_payment_status", ["not_payed", "payed_to_organizer", "refunded"]);

export const ticketTypes = ["NFT", "TSCSBT"] as const;
export const pgTicketTypes = pgEnum("ticket_types", ticketTypes);

export const eventPayment = pgTable(
  "event_payment_info",
  {
    id: serial("id").primaryKey(),
    event_uuid: uuid("event_uuid").references(() => events.event_uuid),
    token_id: integer("token_id")
      .references(() => eventTokens.token_id)
      .notNull(),

    /* -------------------------- Payment Core Columns -------------------------- */
    price: real("price").notNull(),
    recipient_address: text("recipient_address").notNull(),
    bought_capacity: integer("bought_capacity").notNull(),
    /* -------------------------------------------------------------------------- */
    ticket_type: pgTicketTypes("ticket_type").notNull(),
    /* ----------------------------- USED IF HAS NFT ---------------------------- */
    ticketImage: text("ticket_image"),
    ticketVideo: text("ticket_video"),
    collectionAddress: text("collection_address"), // NFT & TSCSBT
    title: text("title"),
    description: text("description").notNull(),

    organizer_payment_status: organizerPaymentStatus("organizer_payment_status").default("not_payed").notNull(),
    ticketActivityId: integer("ticket_activity_id").default(0),
    created_at: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  (table) => ({
    uniqueEven: uniqueIndex().on(table.event_uuid),
    eventUuidIdx: index("event_event_uuid_idx").on(table.event_uuid),
  })
);

export type EventPaymentSelectType = InferSelectModel<typeof eventPayment>;
export type EventTicketType = (typeof ticketTypes)[number];
