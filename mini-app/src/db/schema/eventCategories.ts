import { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Event Categories Schema
 */
export const eventCategories = pgTable(
  "event_categories",
  {
    category_id: serial("category_id").primaryKey(),

    // For enabling/disabling categories without removing them
    enabled: boolean("enabled").default(true),

    // Category name/title
    name: text("name").notNull(),

    // Optional description
    description: text("description").default(""),

    // Icon/image for the category
    icon_url: text("icon_url").default(""),

    // Numerical sort order
    sort_order: integer("sort_order").default(0),

    // Timestamps and auditing info
    created_at: timestamp("created_at", { mode: "string" }).defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string" }).$onUpdate(() => new Date().toString()),
    updated_by: text("updated_by").default("system").notNull(),
  },
  (table) => ({
    // Indexes and unique constraints

    nameIdx: index("event_categories_name_idx").on(table.name),
  })
);

// Type inference for the schema
export type EventCategoryRow = InferSelectModel<typeof eventCategories>;
