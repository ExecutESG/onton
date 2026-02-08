ALTER TABLE "token_campaign_merge_transactions"
    ADD COLUMN "platinum_nft_address" text;--> statement-breakpoint
ALTER TABLE "token_campaign_nft_items"
    ADD COLUMN "merged_into_nft_address" text;--> statement-breakpoint
ALTER TABLE "token_campaign_nft_items"
    ADD COLUMN "merged_into_nft_index" bigint;
ALTER TYPE "campaign_type" ADD VALUE 'merge_platinum';--> statement-breakpoint