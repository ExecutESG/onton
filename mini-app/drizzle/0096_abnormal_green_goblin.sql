DROP INDEX IF EXISTS "event_payment_info_event_uuid_index";--> statement-breakpoint
DROP INDEX IF EXISTS "event_event_uuid_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "event_registrants_event_uuid_user_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "orders_wallet_address_idx";--> statement-breakpoint
ALTER TABLE "event_payment_info" ALTER COLUMN "event_uuid" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_payment_info" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrants" ALTER COLUMN "registrant_uuid" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "event_payment_id" integer;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "order_uuid" uuid;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "buyer_user_id" bigint;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "default_price" real;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "final_price" real;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "mint_wallet_address" text;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD COLUMN "minted_token_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "event_payment_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ticket_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_event_payment_id_event_payment_info_id_fk" FOREIGN KEY ("event_payment_id") REFERENCES "public"."event_payment_info"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_order_uuid_orders_uuid_fk" FOREIGN KEY ("order_uuid") REFERENCES "public"."orders"("uuid") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_buyer_user_id_users_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_event_payment_id_event_payment_info_id_fk" FOREIGN KEY ("event_payment_id") REFERENCES "public"."event_payment_info"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_payment_event_uuid_idx" ON "event_payment_info" USING btree ("event_uuid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_payment_ticket_type_idx" ON "event_payment_info" USING btree ("ticket_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrants_event_uuid_idx" ON "event_registrants" USING btree ("event_uuid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrants_user_id_idx" ON "event_registrants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrants_order_uuid_idx" ON "event_registrants" USING btree ("order_uuid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrants_event_payment_idx" ON "event_registrants" USING btree ("event_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_event_payment_idx" ON "orders" USING btree ("event_payment_id");