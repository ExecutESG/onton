ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "has_web3" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_has_web3_idx" ON "events" ("has_web3");
