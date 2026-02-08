DROP INDEX IF EXISTS "nft_items_order_uuid_index";--> statement-breakpoint
ALTER TABLE "nft_items" ADD COLUMN "registrant_id" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nft_items" ADD CONSTRAINT "nft_items_registrant_id_event_registrants_id_fk" FOREIGN KEY ("registrant_id") REFERENCES "public"."event_registrants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nft_items_order_reg_uq" ON "nft_items" USING btree ("order_uuid","registrant_id") WHERE "nft_items"."registrant_id" IS NOT NULL;