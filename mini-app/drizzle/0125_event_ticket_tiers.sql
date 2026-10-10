CREATE TABLE IF NOT EXISTS "event_ticket_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_uuid" uuid NOT NULL,
	"tier_name" text NOT NULL,
	"price" real DEFAULT 0 NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"sold_count" integer DEFAULT 0 NOT NULL,
	"ticket_type" "ticket_types" DEFAULT 'NFT' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_ticket_tiers" ADD CONSTRAINT "event_ticket_tiers_event_uuid_events_event_uuid_fk" FOREIGN KEY ("event_uuid") REFERENCES "events"("event_uuid") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_ticket_tiers_event_uuid_idx" ON "event_ticket_tiers" ("event_uuid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_ticket_tiers_sort_order_idx" ON "event_ticket_tiers" ("sort_order");
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tier_id" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_tier_id_event_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "event_ticket_tiers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_tier_id_idx" ON "orders" ("tier_id");
--> statement-breakpoint
-- Seed default ticket tier from existing event_payment_info records if not already seeded
INSERT INTO "event_ticket_tiers" ("event_uuid", "tier_name", "price", "capacity", "sold_count", "ticket_type", "description", "sort_order", "updated_by")
SELECT
    epi.event_uuid,
    COALESCE(NULLIF(TRIM(epi.title), ''), 'General Admission') AS tier_name,
    epi.price,
    epi.bought_capacity,
    0,
    epi.ticket_type,
    epi.description,
    0,
    'migration_0125'
FROM "event_payment_info" epi
WHERE NOT EXISTS (
    SELECT 1 FROM "event_ticket_tiers" ett WHERE ett.event_uuid = epi.event_uuid
);
