CREATE TABLE IF NOT EXISTS "users_google" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"g_user_id" text NOT NULL,
	"g_email" varchar(255),
	"g_display_name" text,
	"g_avatar_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_google" ADD CONSTRAINT "users_google_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_google_user_idx" ON "users_google" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_guserid_uq" ON "users_google" USING btree ("g_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_userid_guserid_uq" ON "users_google" USING btree ("user_id","g_user_id");