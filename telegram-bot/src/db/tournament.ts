// modules/games.ts
import { pool } from "./pool";

// The shape of each row in the "games" table
export interface GameRowType {
  id: number;
}


/**
 * Fetch all games in ascending name order.
 */
export async function getLocalTournamentById(tid: string): Promise<GameRowType> {
  const client = await pool.connect();
  try {
    const result = await client.query<GameRowType>(
      `SELECT id
       FROM tournaments
       WHERE host_tournament_id = $1;`,
      [tid],
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
