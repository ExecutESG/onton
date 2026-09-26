CREATE TABLE IF NOT EXISTS "event_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_uuid" varchar(255) NOT NULL,
	"user_id" bigint NOT NULL,
	"reason" varchar(100) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_reports_event_user_uq" ON "event_reports" ("event_uuid", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_reports_event_uuid_idx" ON "event_reports" ("event_uuid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_reports_user_id_idx" ON "event_reports" ("user_id");
