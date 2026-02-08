DO $$ BEGIN
 CREATE TYPE "public"."claim_status" AS ENUM('not_claimed', 'claimed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."wallet_type" AS ENUM('primary', 'secondary');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_campaign_claim_onion" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"wallet_address" varchar(66) NOT NULL,
	"wallet_type" "wallet_type" NOT NULL,
	"ton_proof" varchar(255),
	"snapshot_runtime" timestamp with time zone NOT NULL,
	"platinum_nft_count" integer DEFAULT 0,
	"gold_nft_count" integer DEFAULT 0,
	"silver_nft_count" integer DEFAULT 0,
	"bronze_nft_count" integer DEFAULT 0,
	"onions_from_platinum" numeric(20, 6) DEFAULT '0',
	"onions_from_gold" numeric(20, 6) DEFAULT '0',
	"onions_from_silver" numeric(20, 6) DEFAULT '0',
	"onions_from_bronze" numeric(20, 6) DEFAULT '0',
	"onions_from_score" numeric(20, 6) DEFAULT '0',
	"total_onions" numeric(20, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"tx_hash" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "nft_api_collections" ADD COLUMN "claim_status" "claim_status" DEFAULT 'not_claimed' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_score_snapshot" ADD COLUMN "claim_status" "claim_status" DEFAULT 'not_claimed' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "token_campaign_claim_onion" ADD CONSTRAINT "token_campaign_claim_onion_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "claim_wallet_unique" ON "token_campaign_claim_onion" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claim_user_idx" ON "token_campaign_claim_onion" USING btree ("user_id");