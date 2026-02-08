ALTER TABLE "event_payment_info" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_payment_info" ADD COLUMN "reserved_count" integer DEFAULT 0 NOT NULL;