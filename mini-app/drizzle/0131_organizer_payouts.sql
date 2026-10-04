CREATE TABLE IF NOT EXISTS "organizer_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_uuid" uuid NOT NULL REFERENCES "events"("event_uuid") ON DELETE CASCADE,
	"amount" numeric(20, 9) NOT NULL,
	"token_id" integer REFERENCES "event_tokens"("token_id"),
	"tx_hash" text NOT NULL,
	"paid_by" bigint NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "organizer_payouts_event_uuid_idx" ON "organizer_payouts" ("event_uuid");

ALTER TABLE "event_payment_info" ADD COLUMN IF NOT EXISTS "payout_reminder_sent_at" timestamp with time zone;

UPDATE "orders"
SET "state" = 'cancelled'
WHERE "order_type" IN ('event_creation', 'event_capacity_increment')
  AND "state" IN ('new', 'confirming', 'processing');
