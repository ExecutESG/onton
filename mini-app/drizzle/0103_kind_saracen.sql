DO $$ BEGIN
 CREATE TYPE "public"."user_entry" AS ENUM('telegram', 'web');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partnership_affiliate_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_link_id" bigint NOT NULL,
	"wallet_address" varchar(64) NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"telegram_user_name" varchar(128),
	"usdt_amount" numeric(18, 6) NOT NULL,
	"onion_amount" numeric(18, 6) NOT NULL,
	"time_of_bought" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"user_entry" "user_entry" NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partnership_affiliate_purchases" ADD CONSTRAINT "partnership_affiliate_purchases_affiliate_link_id_affiliate_links_id_fk" FOREIGN KEY ("affiliate_link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partnership_purchases_affiliate_id_idx" ON "partnership_affiliate_purchases" USING btree ("affiliate_link_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partnership_purchases_wallet_idx" ON "partnership_affiliate_purchases" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partnership_purchases_tg_user_idx" ON "partnership_affiliate_purchases" USING btree ("telegram_user_id");