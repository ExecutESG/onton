import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const csbtTrees = pgTable(
  "csbt_trees",
  {
    id: serial("id").primaryKey(),
    eventUuid: uuid("event_uuid").notNull(),
    kind: varchar("kind", { length: 16 }).$type<"native" | "legacy">().notNull(),
    root: text("root").notNull(),
    leafCount: integer("leaf_count").notNull(),
    frozenAt: timestamp("frozen_at", { withTimezone: true }).defaultNow().notNull(),
    minioKey: text("minio_key").notNull(),
    anchorTxHash: text("anchor_tx_hash"),
    anchoredAt: timestamp("anchored_at", { withTimezone: true }),
  },
  (table) => ({
    eventUuidKindUnique: uniqueIndex("csbt_trees_event_uuid_kind_unique").on(
      table.eventUuid,
      table.kind
    ),
    eventUuidIdx: index("idx_csbt_trees_event_uuid").on(table.eventUuid),
    unanchoredIdx: index("idx_csbt_trees_unanchored").on(table.anchoredAt),
  })
);

export type CsbtTreeRow = InferSelectModel<typeof csbtTrees>;
export type CsbtTreeInsert = InferInsertModel<typeof csbtTrees>;
