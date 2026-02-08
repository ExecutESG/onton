import { pgTable, serial, bigint, text, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

/* -------------------------------------------------------------------------- */
/*                        users_github  (GitHub accounts)                     */
/* -------------------------------------------------------------------------- */
export const usersGithub = pgTable(
  "users_github",
  {
    id: serial("id").primaryKey(),

    /** FK back to Telegram user */
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    /** GitHub numeric ID (Snowflake‑ish) */
    ghUserId: text("gh_user_id").notNull(),

    /** login (username) */
    ghLogin: varchar("gh_login", { length: 60 }),

    /** Display name (name field on profile) */
    ghDisplayName: text("gh_display_name"),

    /** Avatar URL */
    ghAvatarUrl: text("gh_avatar_url"),

    /** Optional short‑lived token pieces (drop after use) */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("users_github_user_idx").on(t.userId),
    ghUserIdx: uniqueIndex("users_github_ghuserid_uq").on(t.ghUserId),
    compositeUq: uniqueIndex("users_github_userid_ghuserid_uq").on(t.userId, t.ghUserId),
  })
);

/* --------------------------- Drizzle relations --------------------------- */
export const usersGithubRelations = relations(usersGithub, ({ one }) => ({
  user: one(users, {
    fields: [usersGithub.userId],
    references: [users.user_id],
  }),
}));

export type UsersGithubRow = typeof usersGithub.$inferSelect;
export type UsersGithubInsert = typeof usersGithub.$inferInsert;
