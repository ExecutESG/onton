ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "limits_override" jsonb NULL;
