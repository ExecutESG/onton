import { pgTable, varchar, text, primaryKey, boolean } from "drizzle-orm/pg-core";
import { developmentEnvironment } from "@/db/schema";

export const ontoSetting = pgTable(
  "onton_setting",
  {
    env: developmentEnvironment("env").notNull(),
    var: varchar("var", { length: 255 }).notNull(),
    value: text("value"),
    protected: boolean("protected").default(true),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.env, table.var],
      name: "onto_setting_pk",
    }),
  })
);
