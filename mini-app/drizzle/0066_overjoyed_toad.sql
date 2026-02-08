DO
$$
    BEGIN
        CREATE TYPE "public"."merge_status" AS ENUM ('not_allowed_to_merge', 'able_to_merge', 'waiting_for_transaction', 'merging', 'merged', 'burned');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;
ALTER TABLE "token_campaign_nft_items"
    ADD COLUMN "merge_status" "merge_status" DEFAULT 'not_allowed_to_merge' NOT NULL;