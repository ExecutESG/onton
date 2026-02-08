DO $$ BEGIN
 CREATE TYPE "public"."score_rule_role" AS ENUM('organizer', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_score_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_user_id" bigint,
	"subject_role" "score_rule_role",
	"activity_type" "users_score_activity_type" NOT NULL,
	"item_type" "user_score_item_type" NOT NULL,
	"item_id" bigint,
	"point" numeric(20, 6) NOT NULL,
	"priority" bigint DEFAULT 0,
	"effective_from" timestamp (6),
	"effective_to" timestamp (6),
	"active" boolean DEFAULT true,
	"created_at" timestamp (6) DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_score_rules" ADD CONSTRAINT "user_score_rules_subject_user_id_users_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usr_score_rules_match_idx" ON "user_score_rules" USING btree ("activity_type","item_type","item_id","subject_user_id");