DO $$ BEGIN
    CREATE TABLE "public"."raffle_tokens" (
        "token_id" serial PRIMARY KEY NOT NULL,
        "symbol" text NOT NULL,
        "name" text,
        "decimals" integer NOT NULL DEFAULT 9,
        "master_address" text,
        "is_native" boolean NOT NULL DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3)
    );
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."raffle_tokens" ADD CONSTRAINT "raffle_tokens_symbol_unique" UNIQUE ("symbol");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."event_raffles" ADD COLUMN "token_id" integer DEFAULT 1;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."event_raffles" ADD CONSTRAINT "event_raffles_token_id_raffle_tokens_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."raffle_tokens"("token_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "public"."raffle_tokens" ("token_id", "symbol", "name", "decimals", "master_address", "is_native")
VALUES (1, 'TON', 'Toncoin', 9, NULL, true)
ON CONFLICT ("token_id") DO NOTHING;
--> statement-breakpoint
UPDATE "public"."event_raffles" SET "token_id" = 1 WHERE "token_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "public"."event_raffles" ALTER COLUMN "token_id" SET NOT NULL;
