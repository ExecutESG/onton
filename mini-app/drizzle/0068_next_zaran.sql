CREATE TABLE IF NOT EXISTS "token_campaign_merge_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"transaction_hash" text NOT NULL,
	"gold_nft_address" text,
	"silver_nft_address" text,
	"bronze_nft_address" text,
	"extra_data" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
