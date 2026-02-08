-- Add ZIP/postal code field to merch raffle result tables
ALTER TABLE "event_merch_prize_results" ADD COLUMN IF NOT EXISTS "zip_code" text;
ALTER TABLE "event_merch_raffle_results" ADD COLUMN IF NOT EXISTS "zip_code" text;

