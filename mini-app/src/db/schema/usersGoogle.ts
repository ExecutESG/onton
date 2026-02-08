/* ------------------------------------------------------------------ */
/*                   users_google  – Google account links              */
/* ------------------------------------------------------------------ */

import { pgTable, serial, bigint, text, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

/**
 * ONE Telegram user  ➜  zero‑or‑many Google accounts
 * (change to userId primary‑key if you want “max 1 Google per TG”.)
 */
export const usersGoogle = pgTable(
  "users_google",
  {
    id: serial("id").primaryKey(),

    /* FK → Telegram user */
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    /* Google “sub” claim (string) */
    gUserId: text("g_user_id").notNull(),

    /* E‑mail (optional) */
    gEmail: varchar("g_email", { length: 255 }),

    /* “name” from Google profile */
    gDisplayName: text("g_display_name"),

    /* Avatar */
    gAvatarUrl: text("g_avatar_url"),

    /* Optional short‑lived tokens (delete after use if you like) */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    /* ------------- handy indexes / uniques ------------- */
    userIdx: index("users_google_user_idx").on(t.userId),

    /* unique by Google ID */
    gUserIdUq: uniqueIndex("users_google_guserid_uq").on(t.gUserId),

    /* (user_id , g_user_id) combo – protects against dups */
    compositeUq: uniqueIndex("users_google_userid_guserid_uq").on(t.userId, t.gUserId),
  })
);

/* ------------------------------------------------------------------ */
/*                         relation helper                            */
/* ------------------------------------------------------------------ */
export const usersGoogleRelations = relations(usersGoogle, ({ one }) => ({
  user: one(users, {
    fields: [usersGoogle.userId],
    references: [users.user_id],
  }),
}));

export type UsersGoogleRow = typeof usersGoogle.$inferSelect;
export type UsersGoogleInsert = typeof usersGoogle.$inferInsert;
