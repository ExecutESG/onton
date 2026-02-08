import { users } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { bigint, bigserial, boolean, index, pgEnum, pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { decimal } from "drizzle-orm/pg-core/columns/numeric";
export const userScoreItemArray = ["event", "task", "organize_event", "game"] as const;
// Define ENUM types
export const userScoreItem = pgEnum("user_score_item_type", userScoreItemArray);

export const activityTypesArray = [
  "free_online_event",
  "free_offline_event",
  "paid_online_event",
  "paid_offline_event",
  "join_onton",
  "join_onton_affiliate",
  "free_play2win",
  "paid_play2win",
  "x_connect",
  "github_connect",
  "linked_in_connect",
  "start_bot",
  "open_mini_app",
  "x_view_post",
  "x_retweet",
  "tg_join_channel",
  "tg_join_group",
  "tg_post_view",
  "tg_access_location",
  "google_connect",
  "outlook_connect",
  "web_visit",
] as const;
export const usersScoreActivity = pgEnum("users_score_activity_type", activityTypesArray);

// Create the users_score table
export const usersScore = pgTable(
  "users_score",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id),
    activityType: usersScoreActivity("activity_type"),
    point: decimal("point", { precision: 20, scale: 6 }),
    active: boolean("active"),
    itemId: bigint("item_id", { mode: "number" }),
    itemType: userScoreItem("item_type"),
    createdAt: timestamp("created_at", { precision: 6 }),
  },
  (table) => ({
    // Unique constraint: user_id, activity_type, active, item_id, item_type
    userIdActivityTypeActiveItemIdItemTypeUnique: uniqueIndex(
      "users_score_user_id_activity_type_active_item_id_item_type_key"
    ).on(table.userId, table.activityType, table.active, table.itemId, table.itemType),
    // Index on activity_type
    activityTypeIndex: index("users_score_activity_type_idx").on(table.activityType),
    // Composite index on item_id and item_type
    itemIdItemTypeIndex: index("users_score_item_id_item_type_idx").on(table.itemId, table.itemType),
    // Index on user_id
    userIdIndex: index("users_score_user_id_idx").on(table.userId),
  })
);

export type UsersScoreType = InferSelectModel<typeof usersScore>;
export type UserScoreItemType = (typeof userScoreItem.enumValues)[number];
export type UsersScoreActivityType = (typeof usersScoreActivity.enumValues)[number];
