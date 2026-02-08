import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/**
 * Inserts free_play2win / paid_play2win rows for leaderboard winners
 * who haven’t been scored yet.  Returns the row-count inserted.
 */
export async function syncPlay2WinScores(): Promise<void> {
  const q = sql`
    WITH ins AS (
      INSERT INTO users_score (
          user_id,
          activity_type,
          point,
          active,
          item_id,
          item_type,
          created_at
      )
      SELECT
          gl.telegram_user_id,
          CASE
            WHEN t.prize_type = 'None' THEN 'free_play2win'::users_score_activity_type
            WHEN t.prize_type = 'Coin' THEN 'paid_play2win'::users_score_activity_type
          END                       AS activity_type,
          CASE
            WHEN t.prize_type = 'None' THEN 1
            WHEN t.prize_type = 'Coin' THEN 10
          END                       AS point,
          TRUE                       AS active,
          gl.tournament_id           AS item_id,
          'game'::user_score_item_type,
          NOW()
      FROM   game_leaderboard gl
      JOIN   tournaments t ON t.id = gl.tournament_id
      WHERE  gl.points         > 0
        AND  gl.reward_created = TRUE
        AND  t.prize_type      IN ('None','Coin')
        AND NOT EXISTS (
              SELECT 1
              FROM   users_score us
              WHERE  us.user_id       = gl.telegram_user_id
                AND  us.item_id       = gl.tournament_id
                AND  us.item_type     = 'game'::user_score_item_type
                AND  us.activity_type = (
                       CASE
                         WHEN t.prize_type = 'None' THEN 'free_play2win'
                         ELSE 'paid_play2win'
                       END
                     )::users_score_activity_type
            )
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted FROM ins;
  `;

  const [{ inserted }] = (await db.execute(q)) as Array<{ inserted: number }>;
  logger.info(`Play-to-Win score sync inserted ${inserted} rows`);
  return;
}
