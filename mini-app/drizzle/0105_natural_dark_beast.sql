CREATE TABLE IF NOT EXISTS "users_x" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"x_user_id" text NOT NULL,
	"x_username" varchar(50),
	"x_display_name" text,
	"x_profile_image_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_x" ADD CONSTRAINT "users_x_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_x_user_idx" ON "users_x" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_x_xuserid_uq" ON "users_x" USING btree ("x_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_x_userid_xuserid_uq" ON "users_x" USING btree ("user_id","x_user_id");