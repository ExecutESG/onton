import { bigint, pgTable, serial, text, timestamp, varchar, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { events } from "./events";
import { users } from "./users";

export const eventReports = pgTable(
  "event_reports",
  {
    id: serial("id").primaryKey(),
    event_uuid: varchar("event_uuid", { length: 255 }).notNull(),
    user_id: bigint("user_id", { mode: "number" }).notNull(),
    reason: varchar("reason", { length: 100 }).notNull(),
    notes: text("notes").default("").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at", { precision: 3, mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    eventUserUq: uniqueIndex("event_reports_event_user_uq").on(table.event_uuid, table.user_id),
    eventUuidIdx: index("event_reports_event_uuid_idx").on(table.event_uuid),
    userIdIdx: index("event_reports_user_id_idx").on(table.user_id),
  })
);

export const eventReportsRelations = relations(eventReports, ({ one }) => ({
  event: one(events, {
    fields: [eventReports.event_uuid],
    references: [events.event_uuid],
  }),
  user: one(users, {
    fields: [eventReports.user_id],
    references: [users.user_id],
  }),
}));

export type EventReportRow = typeof eventReports.$inferSelect;
export type EventReportInsert = typeof eventReports.$inferInsert;
