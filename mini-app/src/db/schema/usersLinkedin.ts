import { pgTable, serial, bigint, text, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

/* -------------------------------------------------------------------------- */
/*                       users_linkedin  (LinkedIn accounts)                  */
/* -------------------------------------------------------------------------- */
export const usersLinkedin = pgTable(
  "users_linkedin",
  {
    id: serial("id").primaryKey(),

    /** FK back to the Telegram user */
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    /** LinkedIn member ID (string UUID‐ish) */
    liUserId: text("li_user_id").notNull(),

    /** First / Last names (from r_liteprofile) */
    liFirstName: text("li_first_name"),
    liLastName: text("li_last_name"),

    /** Avatar (displayImage~) */
    liAvatarUrl: text("li_avatar_url"),

    /** Primary email (from r_emailaddress), optional */
    liEmail: varchar("li_email", { length: 255 }),

    /** Optional short‑lived token pieces (drop after use) */
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    /* Helpful indexes / uniques */
    userIdx: index("users_li_user_idx").on(t.userId),
    liUserIdx: uniqueIndex("users_li_liuserid_uq").on(t.liUserId),
    compositeUq: uniqueIndex("users_li_userid_liuserid_uq").on(t.userId, t.liUserId),
  })
);

/* -------------------------------------------------------------------------- */
/*                             Drizzle relations                              */
/* -------------------------------------------------------------------------- */
export const usersLinkedinRelations = relations(usersLinkedin, ({ one }) => ({
  user: one(users, {
    fields: [usersLinkedin.userId],
    references: [users.user_id],
  }),
}));

/* -------------------------------------------------------------------------- */
/*                              Type helpers                                  */
/* -------------------------------------------------------------------------- */
export type UsersLinkedinRow = typeof usersLinkedin.$inferSelect;
export type UsersLinkedinInsert = typeof usersLinkedin.$inferInsert;
