ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "founding_organizer_at" timestamptz NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fee_waiver_tickets_remaining" integer NOT NULL DEFAULT 0;

--> statement-breakpoint
-- Promote orders in 'processing' -> complete + promote
UPDATE "orders"
SET "state" = 'completed',
    "updated_at" = COALESCE("updated_at", NOW()),
    "updated_by" = 'migration_0128'
WHERE "order_type" = 'promote_to_organizer'
  AND "state" = 'processing';

--> statement-breakpoint
-- Backfill: users with a completed promote_to_organizer order -> founding_organizer_at = order completion time, waiver = 100
UPDATE "users" u
SET "founding_organizer_at" = COALESCE(o.completed_time, NOW()),
    "fee_waiver_tickets_remaining" = 100,
    "role" = CASE WHEN u.role = 'admin' THEN 'admin' ELSE 'organizer' END,
    "updated_at" = NOW(),
    "updated_by" = 'migration_0128'
FROM (
  SELECT user_id, MIN(COALESCE(updated_at, created_at)) as completed_time
  FROM "orders"
  WHERE order_type = 'promote_to_organizer'
    AND state = 'completed'
    AND user_id IS NOT NULL
  GROUP BY user_id
) o
WHERE u.user_id = o.user_id;

--> statement-breakpoint
-- Cancel orders in 'new' or 'confirming'
UPDATE "orders"
SET "state" = 'cancelled',
    "updated_at" = NOW(),
    "updated_by" = 'migration_0128'
WHERE "order_type" = 'promote_to_organizer'
  AND "state" IN ('new', 'confirming');
