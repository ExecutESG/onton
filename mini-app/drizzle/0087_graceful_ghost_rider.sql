ALTER TABLE "nft_collection_snapshot" ADD COLUMN "owner_balance" numeric(30, 9) NOT NULL;--> statement-breakpoint
ALTER TABLE "nft_collection_snapshot" ADD COLUMN "metadata" text NOT NULL;