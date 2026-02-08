CREATE TABLE IF NOT EXISTS "user_score_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"snapshot_runtime" timestamp with time zone NOT NULL,
	"free_online_event" numeric(20, 6) DEFAULT '0',
	"free_offline_event" numeric(20, 6) DEFAULT '0',
	"paid_online_event" numeric(20, 6) DEFAULT '0',
	"paid_offline_event" numeric(20, 6) DEFAULT '0',
	"join_onton" numeric(20, 6) DEFAULT '0',
	"join_onton_affiliate" numeric(20, 6) DEFAULT '0',
	"free_play2win" numeric(20, 6) DEFAULT '0',
	"paid_play2win" numeric(20, 6) DEFAULT '0',
	"total_score" numeric(20, 6) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_score_snapshot" ADD CONSTRAINT "user_score_snapshot_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_score_snapshot_user_runtime_idx" ON "user_score_snapshot" USING btree ("user_id","snapshot_runtime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_score_snapshot_user_id_idx" ON "user_score_snapshot" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_score_snapshot_runtime_idx" ON "user_score_snapshot" USING btree ("snapshot_runtime");