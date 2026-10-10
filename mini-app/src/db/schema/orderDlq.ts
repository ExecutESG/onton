import { pgTable, serial, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const orderDlq = pgTable(
  "order_dlq",
  {
    id: serial("id").primaryKey(),
    order_uuid: uuid("order_uuid")
      .references(() => orders.uuid)
      .notNull(),
    error_reason: text("error_reason").notNull(),
    trx_hash: text("trx_hash"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderUuidUq: uniqueIndex("order_dlq_order_uuid_uq").on(table.order_uuid),
  })
);

export type OrderDlqRow = typeof orderDlq.$inferSelect;
export type OrderDlqInsert = typeof orderDlq.$inferInsert;
