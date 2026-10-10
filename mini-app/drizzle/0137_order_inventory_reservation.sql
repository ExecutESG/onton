-- Migration 0137: Order inventory reservation at creation & oversell protection (#1055, #1060)
-- 1. Add inventory_reserved flag and reserved_at timestamp to track tier reservation
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_reserved" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reserved_at" timestamp;
CREATE INDEX IF NOT EXISTS "orders_inventory_reserved_idx" ON "orders" ("inventory_reserved");

-- 2. Backfill completed orders with tier_id as inventory_reserved = true
UPDATE "orders"
SET "inventory_reserved" = true,
    "reserved_at" = COALESCE("reserved_at", "created_at")
WHERE "state" = 'completed' AND "tier_id" IS NOT NULL;

-- 3. Optional DB safety check constraint on event_ticket_tiers:
-- Ensures sold_count never exceeds capacity when capacity is positive (0 = unlimited).
-- NOTE: Uses NOT VALID initially so existing inconsistent data on legacy deployments does not break migration execution.
DO $$ BEGIN
  ALTER TABLE "event_ticket_tiers"
    ADD CONSTRAINT "event_ticket_tiers_sold_count_capacity_check"
    CHECK ("capacity" = 0 OR "sold_count" <= "capacity") NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. SBT payment tx hash tracking & anti-replay protection (#1060)
ALTER TABLE "sbt_items" ADD COLUMN IF NOT EXISTS "payment_tx_hash" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "sbt_items_payment_tx_hash_uq" ON "sbt_items" ("payment_tx_hash");

-- 5. Order Dead-Letter Queue (DLQ) for failed/oversold orders requiring manual refund/review (#1055)
CREATE TABLE IF NOT EXISTS "order_dlq" (
  "id" serial PRIMARY KEY,
  "order_uuid" uuid NOT NULL REFERENCES "orders"("uuid"),
  "error_reason" text NOT NULL,
  "trx_hash" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "order_dlq_order_uuid_uq" ON "order_dlq" ("order_uuid");
