DO $$ BEGIN
 CREATE TYPE "public"."message_send_status" AS ENUM('pending', 'sent', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "coupon_items" ADD COLUMN "invited_user_id" bigint DEFAULT null;--> statement-breakpoint
ALTER TABLE "coupon_items" ADD COLUMN "message_status" "message_send_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "coupon_items" ADD COLUMN "send_attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "coupon_items" ADD COLUMN "last_send_error" text;--> statement-breakpoint
ALTER TABLE "coupon_items" ADD COLUMN "last_send_at" timestamp (3);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_items_message_status_idx" ON "coupon_items" USING btree ("message_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coupon_items_invited_user_id_idx" ON "coupon_items" USING btree ("invited_user_id");