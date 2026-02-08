import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

export const raffleTokens = pgTable(
  "raffle_tokens",
  {
    token_id: serial("token_id").primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name"),
    decimals: integer("decimals").notNull().default(9),
    master_address: text("master_address"),
    logo_url: text("logo_url"),
    is_native: boolean("is_native").notNull().default(false),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at", { mode: "date", precision: 3 }).$onUpdate(() => new Date()),
  },
  (t) => ({
    symbolUnique: uniqueIndex("raffle_tokens_symbol_unique").on(t.symbol),
  })
);

export type RaffleTokenRow = InferSelectModel<typeof raffleTokens>;
