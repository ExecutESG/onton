import { bigint, index, integer, pgTable, text, timestamp, uuid, real, pgEnum } from "drizzle-orm/pg-core";
import { coupon_items, eventTokens, orderState } from "@/db/schema";
import { events } from "@/db/schema/events";
import { users } from "@/db/schema/users";
import { InferSelectModel, relations } from "drizzle-orm";

export const orderTypeValues = [
  "nft_mint",
  "event_creation",
  "event_capacity_increment",
  "promote_to_organizer",
  "ts_csbt_ticket",
] as const;
export type OrderTypeValues = (typeof orderTypeValues)[number];
export const orderTypes = pgEnum("order_types", orderTypeValues);

export const orders = pgTable(
  "orders",
  {
    uuid: uuid("uuid").defaultRandom().primaryKey(),
    event_uuid: uuid("event_uuid").references(() => events.event_uuid),
    user_id: bigint("user_id", { mode: "number" }).references(() => users.user_id),
    default_price: real("default_price").default(0).notNull(),
    total_price: real("total_price").notNull(),
    token_id: integer("token_id")
      .references(() => eventTokens.token_id)
      .notNull(),

    state: orderState("state").notNull(),
    order_type: orderTypes("order_type").notNull(),
    owner_address: text("owner_address"),

    trx_hash: text("trx_hash"),

    utm_source: text("utm_source").default(""),
    created_at: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
    coupon_id: bigint("coupon_id", { mode: "number" }).references(() => coupon_items.id),
  },
  (table) => ({
    eventUuidIdx: index("orders_event_uuid_idx").on(table.event_uuid),
    userIdIdx: index("orders_user_id_idx").on(table.user_id),
    stateIdx: index("orders_state_idx").on(table.state),
    ownerAddressIdx: index("orders_owner_address_idx").on(table.owner_address),
    couponIdIdx: index("orders_coupon_id_idx").on(table.coupon_id),
    walletAddressIdx: index("orders_wallet_address_idx").on(table.owner_address),
    //One event_creation per event_uuid
    // uniqueEventCreation: uniqueIndex("unique_event_creation").on(table.event_uuid, table.order_type).where(eq(table.order_type, "event_creation")),
  })
);

// Relations
export const orderRelations = relations(orders, ({ one }) => ({
  event: one(events, {
    fields: [orders.event_uuid],
    references: [events.event_uuid],
  }),
  user: one(users, {
    fields: [orders.user_id],
    references: [users.user_id],
  }),
  token: one(eventTokens, {
    fields: [orders.token_id],
    references: [eventTokens.token_id],
  }),
}));

export type OrderRow = InferSelectModel<typeof orders>;
