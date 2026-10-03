ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "last_error" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_retry_count_idx" ON "orders" ("retry_count");
