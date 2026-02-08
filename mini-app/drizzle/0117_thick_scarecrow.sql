DO $$ BEGIN
 CREATE TYPE "public"."merch_fulfil_method" AS ENUM('ship', 'pickup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."merch_notif_status" AS ENUM('waiting', 'sent', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."merch_result_status" AS ENUM('pending', 'awaiting_address', 'awaiting_pickup', 'shipped', 'delivered', 'collected', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."merch_prize_status" AS ENUM('draft', 'active', 'distributing', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."raffle_result_status" AS ENUM('pending', 'eligible', 'paid', 'failed', 'not_eligible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."raffle_kind" AS ENUM('ton', 'merch');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."raffle_status" AS ENUM('waiting_funding', 'funded', 'distributing', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_merch_prize_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"merch_raffle_id" integer NOT NULL,
	"merch_prize_id" integer,
	"notif_status" "merch_notif_status" DEFAULT 'waiting' NOT NULL,
	"user_id" bigint NOT NULL,
	"score" integer NOT NULL,
	"rank" integer,
	"status" "merch_result_status" DEFAULT 'pending' NOT NULL,
	"full_name" text,
	"shipping_address" text,
	"phone" text,
	"tracking_number" text,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"collected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3),
	"notif_sent_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_merch_prizes" (
	"merch_prize_id" serial PRIMARY KEY NOT NULL,
	"merch_raffle_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"item_description" text,
	"image_url" text,
	"top_n" integer DEFAULT 1 NOT NULL,
	"fulfil_method" "merch_fulfil_method" DEFAULT 'ship' NOT NULL,
	"need_shipping" boolean DEFAULT true NOT NULL,
	"status" "merch_prize_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_merch_raffle_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"merch_raffle_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"score" integer NOT NULL,
	"rank" integer,
	"status" "merch_result_status" DEFAULT 'pending' NOT NULL,
	"full_name" text,
	"shipping_address" text,
	"phone" text,
	"tracking_number" text,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"collected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_merch_raffles" (
	"merch_raffle_id" serial PRIMARY KEY NOT NULL,
	"merch_raffle_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_raffle_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"raffle_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"score" integer NOT NULL,
	"rank" integer,
	"status" "raffle_result_status" DEFAULT 'pending' NOT NULL,
	"wallet_address" text NOT NULL,
	"reward_nanoton" bigint,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_raffles" (
	"raffle_id" serial PRIMARY KEY NOT NULL,
	"raffle_uuid" uuid NOT NULL,
	"event_id" integer NOT NULL,
	"top_n" integer DEFAULT 10 NOT NULL,
	"prize_pool_nanoton" bigint,
	"status" "raffle_status" DEFAULT 'waiting_funding' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_wallets" (
	"wallet_id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"public_key" text,
	"mnemonic" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "giveaway_wallet_address" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "raffle_kind" "raffle_kind";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_prize_results" ADD CONSTRAINT "event_merch_prize_results_merch_raffle_id_event_merch_raffles_merch_raffle_id_fk" FOREIGN KEY ("merch_raffle_id") REFERENCES "public"."event_merch_raffles"("merch_raffle_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_prize_results" ADD CONSTRAINT "event_merch_prize_results_merch_prize_id_event_merch_prizes_merch_prize_id_fk" FOREIGN KEY ("merch_prize_id") REFERENCES "public"."event_merch_prizes"("merch_prize_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_prize_results" ADD CONSTRAINT "event_merch_prize_results_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_prizes" ADD CONSTRAINT "event_merch_prizes_merch_raffle_id_event_merch_raffles_merch_raffle_id_fk" FOREIGN KEY ("merch_raffle_id") REFERENCES "public"."event_merch_raffles"("merch_raffle_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_raffle_results" ADD CONSTRAINT "event_merch_raffle_results_merch_raffle_id_event_merch_raffles_merch_raffle_id_fk" FOREIGN KEY ("merch_raffle_id") REFERENCES "public"."event_merch_raffles"("merch_raffle_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_raffle_results" ADD CONSTRAINT "event_merch_raffle_results_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merch_raffles" ADD CONSTRAINT "event_merch_raffles_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_raffle_results" ADD CONSTRAINT "event_raffle_results_raffle_id_event_raffles_raffle_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."event_raffles"("raffle_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_raffle_results" ADD CONSTRAINT "event_raffle_results_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_raffles" ADD CONSTRAINT "event_raffles_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_wallets" ADD CONSTRAINT "event_wallets_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merch_spin_unique" ON "event_merch_prize_results" USING btree ("merch_raffle_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merch_prize_user_unique" ON "event_merch_prize_results" USING btree ("merch_prize_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merch_results_prize_idx" ON "event_merch_prize_results" USING btree ("merch_prize_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merch_results_raffle_idx" ON "event_merch_prize_results" USING btree ("merch_raffle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merch_prizes_raffle_idx" ON "event_merch_prizes" USING btree ("merch_raffle_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_merch_raffle_results_unique" ON "event_merch_raffle_results" USING btree ("merch_raffle_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_merch_raffle_results_merch_idx" ON "event_merch_raffle_results" USING btree ("merch_raffle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_merch_raffle_results_status_idx" ON "event_merch_raffle_results" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_merch_raffles_uuid_uq" ON "event_merch_raffles" USING btree ("merch_raffle_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_merch_raffles_event_uq" ON "event_merch_raffles" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_raffle_results_unique" ON "event_raffle_results" USING btree ("raffle_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_raffle_results_raffle_idx" ON "event_raffle_results" USING btree ("raffle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_raffle_results_score_idx" ON "event_raffle_results" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_raffles_uuid_unique" ON "event_raffles" USING btree ("raffle_uuid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_raffles_event_idx" ON "event_raffles" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_wallets_event_id_unique" ON "event_wallets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_wallets_wallet_address_idx" ON "event_wallets" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_giveaway_wallet_address_idx" ON "events" USING btree ("giveaway_wallet_address");