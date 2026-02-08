import { pgTable, bigint, text, timestamp, varchar, index, uniqueIndex, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

/* -------------------------------------------------------------------------- */
/*                             users_x  (X accounts)                          */
/* -------------------------------------------------------------------------- */
/**
 * One Telegram user  ➜  zero‑or‑many X accounts
 *   - If your business logic guarantees “max 1 X per TG user”
 *     just make userId the PRIMARY KEY instead of using `serial id`.
 */
export const usersX = pgTable(
  "users_x",
  {
    id: serial("id").primaryKey(),

    /** FK back to the Telegram user */
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    /** Raw X user id (the long snowflake string) */
    xUserId: text("x_user_id").notNull(),

    /** @handle without the “@” */
    xUsername: varchar("x_username", { length: 50 }),

    /** Display name as shown in the X profile */
    xDisplayName: text("x_display_name"),

    /** Current avatar */
    xProfileImageUrl: text("x_profile_image_url"),

    /** Short‑lived token pieces (optional; drop them after use) */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    /* ------------------------------------------------------ */
    /*                    helpful indexes                     */
    /* ------------------------------------------------------ */
    userIdx: index("users_x_user_idx").on(table.userId),
    xUserIdIdx: uniqueIndex("users_x_xuserid_uq").on(table.xUserId),
    compositeUnique: uniqueIndex("users_x_userid_xuserid_uq").on(table.userId, table.xUserId),
  })
);

/* -------------------------------------------------------------------------- */
/*                         Drizzle relation helpers                           */
/* -------------------------------------------------------------------------- */
export const usersXRelations = relations(usersX, ({ one }) => ({
  user: one(users, {
    fields: [usersX.userId],
    references: [users.user_id],
  }),
}));

export type UsersXRow = typeof usersX.$inferSelect;
export type UsersXInsert = typeof usersX.$inferInsert;
