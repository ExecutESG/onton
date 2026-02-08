// modules/games.ts
import { pool } from "./pool";

// The shape of each row in the "games" table
export interface GameRowType {
  name: string;
  host_game_id: string;
}

/**
 * Fetch all games in ascending name order.
 */
export async function getGames(): Promise<GameRowType[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<GameRowType>(
      `SELECT name, host_game_id
       FROM games
       ORDER BY name;`,
    );
    return result.rows;
  } finally {
    client.release();
  }
}
