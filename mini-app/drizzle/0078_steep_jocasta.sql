DO $$ BEGIN
 CREATE TYPE "public"."nft_status_enum" AS ENUM('CREATING', 'VALIDATION_FAILED', 'COMPLETED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nft_api_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"minter_wallet_id" bigint NOT NULL,
	"api_key_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image" varchar(255),
	"cover_image" varchar(255),
	"social_links" json,
	"address" varchar(255),
	"friendly_address" varchar(255),
	"status" "nft_status_enum" DEFAULT 'CREATING' NOT NULL,
	"royalties" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3) DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nft_api_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" bigint NOT NULL,
	"name" varchar(255),
	"description" text,
	"image" varchar(255),
	"content_url" varchar(255),
	"content_type" varchar(100),
	"buttons" json,
	"attributes" json,
	"address" varchar(255),
	"friendly_address" varchar(255),
	"nft_index" bigint,
	"owner_wallet_address" varchar(255),
	"status" "nft_status_enum" DEFAULT 'CREATING' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3) DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nft_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3) DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nft_api_minter_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"api_key_id" bigint NOT NULL,
	"friendly_name" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3) DEFAULT now()
);
--> statement-breakpoint
DROP INDEX IF EXISTS "token_campaign_orders_uuid_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_collections_address_idx" ON "nft_api_collections" USING btree ("address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_collections_minter_idx" ON "nft_api_collections" USING btree ("minter_wallet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_collections_apikey_idx" ON "nft_api_collections" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_items_collection_id_idx" ON "nft_api_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_items_address_idx" ON "nft_api_items" USING btree ("address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_items_owner_idx" ON "nft_api_items" USING btree ("owner_wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_keys_api_key_idx" ON "nft_api_keys" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_minter_wallets_wallet_address_idx" ON "nft_api_minter_wallets" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nft_api_minter_wallets_api_key_id_idx" ON "nft_api_minter_wallets" USING btree ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "token_campaign_orders_uuid_idxe" ON "token_campaign_orders" USING btree ("uuid");