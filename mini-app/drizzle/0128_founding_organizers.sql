-- 1. Add founding_organizer_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS founding_organizer_at timestamp;

-- 2. Backfill for users with paid or confirmed NFT orders
-- The completion time is orders.updated_at because there is no completion column.
UPDATE users u
SET 
  founding_organizer_at = sub.promoted_at,
  role = CASE WHEN u.role = 'user' THEN 'organizer'::role_enum ELSE u.role END
FROM (
  SELECT 
    user_id,
    MIN(updated_at) as promoted_at
  FROM orders
  WHERE order_type IN ('new', 'confirming')
    AND payment_status = 'processing'
  GROUP BY user_id
) sub
WHERE u.user_id = sub.user_id
  AND u.founding_organizer_at IS NULL;

-- 3. Create partial index for fast lookups
CREATE INDEX IF NOT EXISTS users_founding_organizer_at_idx ON users (founding_organizer_at) WHERE founding_organizer_at IS NOT NULL;
