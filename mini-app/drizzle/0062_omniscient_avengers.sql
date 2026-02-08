CREATE TABLE IF NOT EXISTS "token_campaign_nft_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" bigint NOT NULL,
	"item_type" "campaign_type" NOT NULL,
	"nft_address" text NOT NULL,
	"index" bigint NOT NULL,
	"collection_address" text NOT NULL,
	"owner" bigint NOT NULL,
	"created_at" timestamp (6) DEFAULT now(),
	"updated_at" timestamp (3),
	"updated_by" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "token_campaign_nft_items" ADD CONSTRAINT "token_campaign_nft_items_owner_users_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
