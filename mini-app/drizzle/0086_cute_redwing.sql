CREATE TABLE IF NOT EXISTS "nft_collection_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_runtime" timestamp with time zone NOT NULL,
	"collection_address" varchar(66) NOT NULL,
	"nft_address" varchar(66) NOT NULL,
	"owner_address" varchar(66) NOT NULL,
	"nft_index" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_categories" ALTER COLUMN "updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_runtime_nft_idx" ON "nft_collection_snapshot" USING btree ("snapshot_runtime","nft_address");