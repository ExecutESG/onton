import { pgTable, serial, bigint, text, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/db/schema/users";

export const usersOutlook = pgTable(
  "users_outlook",
  {
    id: serial("id").primaryKey(),

    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, { onDelete: "cascade", onUpdate: "cascade" }),

    msUserId: text("ms_user_id").notNull(), // Graph id string
    msDisplayName: text("ms_display_name"),
    msGivenName: varchar("ms_given_name", { length: 100 }),
    msSurname: varchar("ms_surname", { length: 100 }),
    msUserPrincipalName: text("ms_upn"),
    msAvatarUrl: text("ms_avatar_url"),

    // optional access‑token fragments (short‑lived)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("users_outlook_user_idx").on(t.userId),
    msIdUq: uniqueIndex("users_outlook_msid_uq").on(t.msUserId),
    compositeUq: uniqueIndex("users_outlook_userid_msid_uq").on(t.userId, t.msUserId),
  })
);

export type UsersOutlookRow = typeof usersOutlook.$inferSelect;
export type UsersOutlookInsert = typeof usersOutlook.$inferInsert;
