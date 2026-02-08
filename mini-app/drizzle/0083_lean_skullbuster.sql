CREATE TABLE IF NOT EXISTS "event_categories" (
	"category_id" serial PRIMARY KEY NOT NULL,
	"category_uuid" uuid NOT NULL,
	"enabled" boolean DEFAULT true,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"icon_url" text DEFAULT '',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3),
	"updated_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "category_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_categories_category_uuid_idx" ON "event_categories" USING btree ("category_uuid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_categories_name_idx" ON "event_categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_categories_category_uuid_unique" ON "event_categories" USING btree ("category_uuid");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_category_id_event_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("category_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_category_id_idx" ON "events" USING btree ("category_id");