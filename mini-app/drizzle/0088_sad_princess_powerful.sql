DO $$ BEGIN
    ALTER TYPE "users_score_activity_type" ADD VALUE  'free_play2win';
    ALTER TYPE "users_score_activity_type" ADD VALUE  'paid_play2win';
END $$;


