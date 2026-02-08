import { db } from "@/db/db";
import { eq } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { games, GamesRow, GamesRowInsert } from "@/db/schema/games";
import type { PgTransaction } from "drizzle-orm/pg-core/session";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

export interface GamerData {
  telegramId: number;
  userId: string;
  nickname?: string;
  position: number;
  points: number;
  matchId: string;
  endedAt: string;
}

/**
 * Insert a new row in the 'games' table.
 * Returns the inserted row (GamesRow) or undefined if none.
 */
export const addGame = async (gameData: GamesRowInsert): Promise<GamesRow | undefined> => {
  try {
    const [inserted] = await db.insert(games).values(gameData).returning().execute();

    if (inserted) {
      logger.log("Game inserted:", inserted);
      return inserted;
    }
    return undefined;
  } catch (error) {
    logger.error("Error inserting game:", error);
    throw error;
  }
};

export const insertGameTx = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], data: GamesRowInsert) => {
  const [inserted] = await tx.insert(games).values(data).returning().execute();
  return inserted;
};

/**
 * Fetch a game by its local primary key (games.id).
 * Returns a GamesRow or undefined if not found.
 */
export const getGameById = async (gameId: string): Promise<GamesRow | undefined> => {
  try {
    const [row] = await db.select().from(games).where(eq(games.hostGameId, gameId)).execute();

    return row;
  } catch (error) {
    logger.error("Error getting game by ID:", error);
    throw error;
  }
};

export const updateGameTx = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  gameId: string,
  data: Partial<GamesRowInsert>
) => {
  const result = await tx.update(games).set(data).where(eq(games.hostGameId, gameId)).execute();
  return result;
};

/**
 * Optional: Add more CRUD methods, e.g. getGameByHostGameId, updateGame, etc.
 */

export const gamesDB = {
  addGame,
  insertGameTx,
  getGameById,
  updateGameTx,
};
