DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "token_campaign_merge_transactions" ADD COLUMN "status" "status" DEFAULT 'pending';