// db/schema/eventWallets.ts
import { events } from "@/db/schema/events";
import { pgTable, serial, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

/**
 * One row = one wallet for one event.
 * `mnemonic` should be stored **encrypted** in production!
 */
export const eventWallets = pgTable(
  "event_wallets",
  {
    wallet_id: serial("wallet_id").primaryKey(),

    /** FK → events.event_id (1-to-1) */
    event_id: integer("event_id")
      .references(() => events.event_id, { onDelete: "cascade" })
      .notNull(),

    /** TON bounceable address, e.g. EQB… */
    wallet_address: text("wallet_address").notNull(),

    /** Base-64 Ed25519 public key (optional but handy for audits) */
    public_key: text("public_key"),

    /**
     * 24-word seed phrase.
     * 🔐  PRODUCTION: store PGP- or libsodium-encrypted text instead.
     */
    mnemonic: text("mnemonic").notNull(),

    /*
     * House-keeping
     * -------------------------------------------------------------------- */
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
  },
  (table) => ({
    /** Enforce exactly one wallet per event */
    eventIdUnique: uniqueIndex("event_wallets_event_id_unique").on(table.event_id),

    /** Fast look-up by wallet address */
    walletAddressIdx: index("event_wallets_wallet_address_idx").on(table.wallet_address),
  })
);

export type EventWalletRow = InferSelectModel<typeof eventWallets>;
