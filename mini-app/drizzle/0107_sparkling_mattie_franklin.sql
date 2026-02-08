CREATE TABLE IF NOT EXISTS "users_linkedin" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"li_user_id" text NOT NULL,
	"li_first_name" text,
	"li_last_name" text,
	"li_avatar_url" text,
	"li_email" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_linkedin" ADD CONSTRAINT "users_linkedin_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_li_user_idx" ON "users_linkedin" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_li_liuserid_uq" ON "users_linkedin" USING btree ("li_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_li_userid_liuserid_uq" ON "users_linkedin" USING btree ("user_id","li_user_id");