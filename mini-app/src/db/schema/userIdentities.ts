/* ------------------------------------------------------------------ */
/*              user_identities – Multi-provider user identities       */
/* ------------------------------------------------------------------ */

import {
  pgTable,
  uuid,
  bigint,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";

export type AuthProvider = "telegram" | "google" | "email" | "ton_wallet" | "discord" | "apple";

/**
 * Maps external identity providers (Telegram, Google, Email, TON wallet, Discord)
 * to a single canonical ONTON user.
 */
export const user_identities = pgTable(
  "user_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /* FK → users.user_id */
    user_id: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    /* Identity provider name */
    provider: varchar("provider", { length: 50 }).notNull(),

    /* External ID in the provider's domain (e.g. TG numeric ID, Google 'sub', email address, TON wallet raw address) */
    provider_user_id: text("provider_user_id").notNull(),

    /* Metadata from provider (e.g. display name, email, avatar, raw profile payload) */
    provider_metadata: jsonb("provider_metadata"),

    /* Whether the external identity was verified */
    verified: boolean("verified").default(true).notNull(),

    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    /* Unique composite index: one external account can only be linked once across the platform */
    providerUserIdx: uniqueIndex("user_identities_provider_user_id_uq").on(
      table.provider,
      table.provider_user_id
    ),
    userIdIdx: index("user_identities_user_id_idx").on(table.user_id),
    providerIdx: index("user_identities_provider_idx").on(table.provider),
  })
);

export const userIdentitiesRelations = relations(user_identities, ({ one }) => ({
  user: one(users, {
    fields: [user_identities.user_id],
    references: [users.user_id],
  }),
}));

export type UserIdentityRow = typeof user_identities.$inferSelect;
export type UserIdentityInsert = typeof user_identities.$inferInsert;
