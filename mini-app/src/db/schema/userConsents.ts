/* ------------------------------------------------------------------ */
/*              user_consents – GDPR user consent tracking            */
/* ------------------------------------------------------------------ */

import {
  pgTable,
  serial,
  bigint,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

export const CONSENT_PURPOSES = [
  "audience_reach",
  "sponsor_stats",
  "attendance_verification_api",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CURRENT_PRIVACY_POLICY_VERSION = "2024-09-11";

export const user_consents = pgTable(
  "user_consents",
  {
    id: serial("id").primaryKey(),

    /* FK → users.user_id */
    user_id: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    purpose: varchar("purpose", { length: 64 }).notNull(),

    policy_version: varchar("policy_version", { length: 32 }).notNull(),

    granted_at: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    revoked_at: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    userPurposeVersionUq: uniqueIndex("user_consents_user_purpose_version_uq").on(
      table.user_id,
      table.purpose,
      table.policy_version
    ),
    activePurposeIdx: index("user_consents_purpose_active_idx")
      .on(table.purpose)
      .where(sql`"revoked_at" IS NULL`),
    userIdIdx: index("user_consents_user_id_idx").on(table.user_id),
    userPurposeActiveIdx: index("user_consents_user_purpose_active_idx")
      .on(table.user_id, table.purpose)
      .where(sql`"revoked_at" IS NULL`),
  })
);

export const userConsentsRelations = relations(user_consents, ({ one }) => ({
  user: one(users, {
    fields: [user_consents.user_id],
    references: [users.user_id],
  }),
}));

export type UserConsentRow = typeof user_consents.$inferSelect;
export type UserConsentInsert = typeof user_consents.$inferInsert;
