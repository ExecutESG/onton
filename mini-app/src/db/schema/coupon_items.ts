import { index, integer, pgTable, serial, timestamp, uuid, pgEnum, text, uniqueIndex, bigint } from "drizzle-orm/pg-core";
import { events } from "@/db/schema/events";
import { coupon_definition } from "./coupon_definition";
import { InferModel } from "drizzle-orm";

export const coupon_item_status = pgEnum("coupon_item_status", ["used", "unused"]);
export const couponMessageSendStatus = pgEnum("message_send_status", [
  "pending", // never tried / waiting for cron-job
  "sent", // Telegram reported success
  "failed", // all retries exhausted (see `send_attempts`)
]);

export const coupon_items = pgTable(
  "coupon_items",
  {
    id: serial("id").primaryKey(),

    // "onDelete: 'cascade'" causes coupon_items rows to be deleted automatically if the event is deleted
    event_uuid: uuid("event_uuid").references(() => events.event_uuid, {
      onDelete: "cascade",
      onUpdate: "cascade", // optional
    }),

    // Similarly, if the coupon_definition row is deleted, all related coupon_items rows will be deleted automatically
    coupon_definition_id: integer("coupon_definition_id")
      .references(() => coupon_definition.id, {
        onDelete: "cascade",
        onUpdate: "cascade", // optional
      })
      .notNull(),

    code: text("code").notNull(),
    coupon_status: coupon_item_status("coupon_status").notNull().default("unused"),
    /** Telegram numeric user-id for whom we *intend* to send the code.
     *  Null ➜ coupon was created by the old “quantity” workflow. */
    invited_user_id: bigint("invited_user_id", { mode: "number" }).$type<number | null>().default(null),

    /** Current delivery state (see enum above). */
    message_status: couponMessageSendStatus("message_status").notNull().default("pending"),

    /** How many times the cron-job has tried to deliver this code. */
    send_attempts: integer("send_attempts").default(0),

    /** Optional error text from the last failed attempt. */
    last_send_error: text("last_send_error"),

    /** Timestamp of the last delivery attempt (successful or not). */
    last_send_at: timestamp("last_send_at", {
      mode: "date",
      precision: 3,
    }),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (table) => ({
    couponItemEventUuidIdx: index("coupon_items_event_uuid_idx").on(table.event_uuid),
    couponItemsCodeIdx: index("coupon_items_code_idx").on(table.code),
    couponItemsCouponStatusIdx: index("coupon_items_coupon_status_idx").on(table.coupon_status),
    couponItemsGroupIdIdx: index("coupon_items_group_id_idx").on(table.coupon_definition_id),
    couponItemsEventUuidCodeUq: uniqueIndex("coupon_items_event_uuid_code_uq").on(table.event_uuid, table.code),
    couponItemsMessageStatusIdx: index("coupon_items_message_status_idx").on(table.message_status),
    couponItemsInvitedUserIdIdx: index("coupon_items_invited_user_id_idx").on(table.invited_user_id),
  })
);

// 1) Type for reading rows from coupon_items (i.e., SELECT queries)
export type CouponItem = InferModel<typeof coupon_items, "select">;

// 2) Type for inserting new rows into coupon_items
export type CouponItemInsert = InferModel<typeof coupon_items, "insert">;

export type CouponMessageSendStatus = (typeof couponMessageSendStatus.enumValues)[number];
