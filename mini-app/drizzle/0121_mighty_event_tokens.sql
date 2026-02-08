DROP VIEW IF EXISTS "public"."event_details_search_list";
--> statement-breakpoint
DO $$ BEGIN
    CREATE TABLE "public"."event_tokens" (
        "token_id" serial PRIMARY KEY NOT NULL,
        "symbol" text NOT NULL,
        "name" text,
        "decimals" integer NOT NULL DEFAULT 9,
        "master_address" text,
        "logo_url" text,
        "is_native" boolean NOT NULL DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3)
    );
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."event_tokens" ADD CONSTRAINT "event_tokens_symbol_unique" UNIQUE ("symbol");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "public"."event_tokens" ("token_id", "symbol", "name", "decimals", "master_address", "is_native")
VALUES
    (1, 'TON', 'Toncoin', 9, NULL, true),
    (2, 'USDT', 'Tether USD (TON)', 6, NULL, false),
    (3, 'STAR', 'Star Token', 9, NULL, false)
ON CONFLICT ("token_id") DO NOTHING;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."event_payment_info" ADD COLUMN "token_id" integer;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
UPDATE "public"."event_payment_info" epi
SET "token_id" = et."token_id"
FROM "public"."event_tokens" et
WHERE et."symbol"::text = epi."payment_type"::text;
--> statement-breakpoint
UPDATE "public"."event_payment_info"
SET "token_id" = 1
WHERE "token_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "public"."event_payment_info" ALTER COLUMN "token_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."event_payment_info" ADD CONSTRAINT "event_payment_info_token_id_event_tokens_token_id_fk"
        FOREIGN KEY ("token_id") REFERENCES "public"."event_tokens"("token_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."orders" ADD COLUMN "token_id" integer;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
UPDATE "public"."orders" o
SET "token_id" = et."token_id"
FROM "public"."event_tokens" et
WHERE et."symbol"::text = o."payment_type"::text;
--> statement-breakpoint
UPDATE "public"."orders"
SET "token_id" = 1
WHERE "token_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "public"."orders" ALTER COLUMN "token_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_token_id_event_tokens_token_id_fk"
        FOREIGN KEY ("token_id") REFERENCES "public"."event_tokens"("token_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."event_payment_info" DROP COLUMN IF EXISTS "payment_type";
--> statement-breakpoint
ALTER TABLE "public"."orders" DROP COLUMN IF EXISTS "payment_type";
--> statement-breakpoint
CREATE VIEW "public"."event_details_search_list" AS
 SELECT e.event_id,
    e.event_uuid,
    e.title,
    e.description,
    e.start_date,
    e.end_date,
    e.type,
    e.society_hub,
    e.society_hub_id,
    e.image_url,
    e.location,
    e.subtitle,
    e."ticketToCheckIn",
    e.timezone,
    e.website,
    e.created_at,
    e.hidden,
    e.city_id,
    e.has_payment,
    e.has_registration,
    e.has_approval,
    e.category_id,
    city.title AS city,
    e.country_id,
    country.title AS country,
    e.participation_type,
    organizer.user_id AS organizer_user_id,
    organizer.first_name AS organizer_first_name,
    organizer.last_name AS organizer_last_name,
    organizer.username AS organizer_username,
    organizer.photo_url AS organizer_photo_url,
    COALESCE(organizer.org_channel_name, organizer.first_name::character varying) AS organizer_channel_name,
    COALESCE(organizer.org_image, organizer.photo_url::character varying) AS organizer_image,
    organizer.org_bio AS organizer_bio,
    organizer.org_x_link AS organizer_x_link,
    organizer.org_support_telegram_user_name AS organizer_support_telegram_user_name,
    (
        SELECT count(t.id) AS count
        FROM tickets t
        WHERE t.event_uuid = e.event_uuid
    ) AS reserved_count,
    (
        SELECT count(v.id) AS count
        FROM visitors v
        WHERE v.event_uuid = e.event_uuid
    ) AS visitor_count,
    min_tickets.id AS ticket_id,
    min_tickets.title AS ticket_title,
    min_tickets.description AS ticket_description,
    min_tickets.price AS ticket_price,
    min_tickets.ticket_image,
    min_tickets.symbol AS payment_type,
    min_tickets.token_id AS payment_token_id
   FROM events e
     LEFT JOIN users organizer ON e.owner = organizer.user_id
     LEFT JOIN giata_city city ON e.city_id = city.id
     LEFT JOIN giata_city country ON e.country_id = country.id
     LEFT JOIN LATERAL (
             SELECT et.id,
                et.title,
                et.description,
                et.price,
                et.ticket_image,
                tok.symbol,
                et.token_id
               FROM event_payment_info et
                 JOIN event_tokens tok ON tok.token_id = et.token_id
              WHERE et.event_uuid = e.event_uuid
              ORDER BY et.price
              LIMIT 1
            ) min_tickets ON true;
--> statement-breakpoint
