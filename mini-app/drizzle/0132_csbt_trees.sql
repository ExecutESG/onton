CREATE TABLE IF NOT EXISTS "csbt_trees" (
    "id" serial PRIMARY KEY NOT NULL,
    "event_uuid" uuid NOT NULL,
    "kind" varchar(16) NOT NULL CHECK (kind IN ('native', 'legacy')),
    "root" text NOT NULL,
    "leaf_count" integer NOT NULL,
    "frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "minio_key" text NOT NULL,
    "anchor_tx_hash" text,
    "anchored_at" timestamp with time zone,
    CONSTRAINT "csbt_trees_event_uuid_kind_unique" UNIQUE("event_uuid", "kind")
);

CREATE INDEX IF NOT EXISTS "idx_csbt_trees_event_uuid" ON "csbt_trees" ("event_uuid");
CREATE INDEX IF NOT EXISTS "idx_csbt_trees_unanchored" ON "csbt_trees" ("anchored_at") WHERE "anchored_at" IS NULL;
