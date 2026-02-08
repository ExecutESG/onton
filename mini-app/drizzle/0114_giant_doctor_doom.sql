CREATE TABLE IF NOT EXISTS "users_outlook" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"ms_user_id" text NOT NULL,
	"ms_display_name" text,
	"ms_given_name" varchar(100),
	"ms_surname" varchar(100),
	"ms_upn" text,
	"ms_avatar_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_outlook" ADD CONSTRAINT "users_outlook_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_outlook_user_idx" ON "users_outlook" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_outlook_msid_uq" ON "users_outlook" USING btree ("ms_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_outlook_userid_msid_uq" ON "users_outlook" USING btree ("user_id","ms_user_id");