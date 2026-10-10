ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "platform_fee_raw" bigint;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "organizer_amount_raw" bigint;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fee_bps" integer;
