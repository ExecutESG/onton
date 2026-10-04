CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_consents_user_purpose_version_uq" UNIQUE ("user_id", "purpose", "policy_version")
);

--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consents_purpose_active_idx" ON "user_consents" ("purpose") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consents_user_id_idx" ON "user_consents" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consents_user_purpose_active_idx" ON "user_consents" ("user_id", "purpose") WHERE "revoked_at" IS NULL;
