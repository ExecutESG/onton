CREATE TABLE IF NOT EXISTS "users_github" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"gh_user_id" text NOT NULL,
	"gh_login" varchar(60),
	"gh_display_name" text,
	"gh_avatar_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_github" ADD CONSTRAINT "users_github_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_github_user_idx" ON "users_github" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_ghuserid_uq" ON "users_github" USING btree ("gh_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_userid_ghuserid_uq" ON "users_github" USING btree ("user_id","gh_user_id");