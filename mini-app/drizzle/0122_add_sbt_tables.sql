DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS "public"."sbt_collections" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_uuid" varchar(255) NOT NULL,
        "collection_address" varchar(255) NOT NULL,
        "owner_address" varchar(255) NOT NULL,
        "authority_address" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "image" varchar(500),
        "metadata_url" varchar(500) NOT NULL,
        "common_content_url" varchar(500) DEFAULT '',
        "next_item_index" bigint DEFAULT 0 NOT NULL,
        "total_minted" bigint DEFAULT 0 NOT NULL,
        "status" varchar(50) DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3) DEFAULT now()
    );
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_collections_event_uuid_idx" ON "public"."sbt_collections" USING btree ("event_uuid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_collections_address_idx" ON "public"."sbt_collections" USING btree ("collection_address");
--> statement-breakpoint
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS "public"."sbt_items" (
        "id" serial PRIMARY KEY NOT NULL,
        "sbt_collection_id" bigint NOT NULL,
        "item_index" bigint NOT NULL,
        "item_address" varchar(255) NOT NULL,
        "recipient_user_id" bigint,
        "recipient_wallet_address" varchar(255) NOT NULL,
        "metadata_url" varchar(500) NOT NULL,
        "status" varchar(50) DEFAULT 'minted' NOT NULL,
        "transaction_hash" varchar(255),
        "revoked_at" timestamp,
        "metadata" json,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3) DEFAULT now()
    );
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_items_collection_id_idx" ON "public"."sbt_items" USING btree ("sbt_collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_items_address_idx" ON "public"."sbt_items" USING btree ("item_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_items_recipient_wallet_idx" ON "public"."sbt_items" USING btree ("recipient_wallet_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbt_items_recipient_user_idx" ON "public"."sbt_items" USING btree ("recipient_user_id");
