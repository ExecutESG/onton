CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" text NOT NULL,
	"provider_metadata" jsonb,
	"verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_provider_user_id_uq" ON "user_identities" ("provider","provider_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identities_user_id_idx" ON "user_identities" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_identities_provider_idx" ON "user_identities" ("provider");

--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uuid" uuid DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar(50) DEFAULT 'telegram';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" bigint;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_uuid_idx" ON "users" ("uuid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_telegram_id_idx" ON "users" ("telegram_id");

--> statement-breakpoint
-- Backfill telegram_id for existing Telegram users
UPDATE "users" SET "telegram_id" = "user_id" WHERE "telegram_id" IS NULL AND "user_id" < 100000000000000;

--> statement-breakpoint
-- Backfill Telegram identities into user_identities
INSERT INTO "user_identities" ("user_id", "provider", "provider_user_id", "verified")
SELECT "user_id", 'telegram', "user_id"::text, true
FROM "users"
WHERE "user_id" < 100000000000000
ON CONFLICT ("provider", "provider_user_id") DO NOTHING;

--> statement-breakpoint
-- Backfill Google identities if users_google exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users_google') THEN
    INSERT INTO "user_identities" ("user_id", "provider", "provider_user_id", "provider_metadata", "verified")
    SELECT "user_id", 'google', "g_user_id", jsonb_build_object('email', "g_email", 'name', "g_display_name", 'picture', "g_avatar_url"), true
    FROM "users_google"
    ON CONFLICT ("provider", "provider_user_id") DO NOTHING;
  END IF;
END $$;
