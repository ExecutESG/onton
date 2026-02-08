import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { events } from "@/db/schema/events";
import { eq, InferSelectModel, relations } from "drizzle-orm";
import { userEventFields } from "@/db/schema/userEventFields";
import { redisTools } from "@/lib/redisTools";
import eventFieldsDB from "@/db/modules/eventFields.db";
import { db } from "@/db/db";

export const eventFields = pgTable(
  "event_fields",
  {
    id: serial("id").primaryKey(),
    emoji: text("emoji"),
    title: text("title"),
    description: text("description"),
    placeholder: text("placeholder"),
    type: text("type"),
    order_place: integer("order_place"),
    event_id: integer("event_id").references(() => events.event_id),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  (table) => ({
    titleIdx: index("eventf_title_idx").on(table.title),
    typeIdx: index("eventf_type_idx").on(table.type),
    eventIdIdx: index("eventf_event_id_idx").on(table.event_id),
    updatedAtIdx: index("eventf_updated_at_idx").on(table.updatedAt),
  })
);

// Relations
export const eventFieldRelations = relations(eventFields, ({ one, many }) => ({
  event: one(events, {
    fields: [eventFields.event_id],
    references: [events.event_id],
  }),
  userEventFields: many(userEventFields),
}));

export type EventField = InferSelectModel<typeof eventFields>;
