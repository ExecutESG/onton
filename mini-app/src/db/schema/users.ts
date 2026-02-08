import { bigint, text, timestamp, boolean, integer, varchar, index, pgTable } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { airdropRoutines } from "@/db/schema/airdropRoutines";
import { tickets } from "@/db/schema/tickets";
import { userEventFields } from "@/db/schema/userEventFields";
import { usersX } from "./usersX";

// @ts-ignore
// @ts-ignore
export const users = pgTable(
  "users",
  {
    user_id: bigint("user_id", { mode: "number" }).primaryKey(),
    username: text("username"),
    first_name: text("first_name"),
    last_name: text("last_name"),
    wallet_address: text("wallet_address"),
    language_code: text("language_code"),
    role: text("role").notNull(),
    created_at: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
    is_premium: boolean("is_premium"),
    allows_write_to_pm: boolean("allows_write_to_pm"),
    photo_url: text("photo_url"),
    participated_event_count: integer("participated_event_count"),
    hosted_event_count: integer("hosted_event_count"),
    has_blocked_the_bot: boolean("has_blocked_the_bot"),
    org_channel_name: varchar("org_channel_name", { length: 255 }),
    org_support_telegram_user_name: varchar("org_support_telegram_user_name", {
      length: 255,
    }),
    org_x_link: varchar("org_x_link", { length: 255 }),
    org_bio: text("org_bio"),
    org_image: varchar("org_image", { length: 255 }),

    /* -------------------------------------------------------------------------- */
    /*                                   Points                                   */
    /* -------------------------------------------------------------------------- */
    user_point: integer("user_point").notNull().default(0),
    affiliatorUserId: bigint("affiliator_user_id", { mode: "number" }),
  },
  (table) => ({
    usernameIdx: index("users_username_idx").on(table.username),
    walletAddressIdx: index("users_wallet_address_idx").on(table.wallet_address),
    roleIdx: index("users_role_idx").on(table.role),
    createdAtIdx: index("users_created_at_idx").on(table.created_at),
    updatedAtIdx: index("users_updated_at_idx").on(table.updatedAt),
    isPremiumIdx: index("users_is_premium_idx").on(table.is_premium),
    hostedEventCountIdx: index("users_hosted_event_count_idx").on(table.hosted_event_count),
    orgChannelNameIdx: index("users_org_channel_name_idx").on(table.org_channel_name),
    userIdIdx: index("users_id").on(table.user_id),
  })
);

// Relations
export const userRelations = relations(users, ({ many }) => ({
  userEventFields: many(userEventFields),
  airdropRoutines: many(airdropRoutines),
  tickets: many(tickets),
  xAccounts: many(usersX),
  // orders: many(orders),
}));
