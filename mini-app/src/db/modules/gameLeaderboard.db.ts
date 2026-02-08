import { gameLeaderboard, tournamentPrizeType, users } from "@/db/schema";
import { GamerData } from "@/db/modules/games.db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";
import { tournaments } from "@/db/schema/tournaments";

/**
 * Insert participant records into the local `game_leaderboard`
 * but first, ensure each participant's `telegramId` user exists in `users`.
 * If not, insert them with role='user'.
 */
export async function insertParticipantsToLeaderboard(
  tourney: { id: number; gameId: number; hostTournamentId: string },
  participants: GamerData[]
) {
  if (!participants.length) return;

  // 1) Gather distinct telegramIds from participants
  const distinctTelegramIds = Array.from(
    new Set(participants.map((p) => p.telegramId).filter((id) => id > 0)) // exclude 0 or invalid IDs
  );

  if (distinctTelegramIds.length) {
    // 2) Fetch existing user_ids from the 'users' table
    const existingUsers = await db
      .select({ user_id: users.user_id })
      .from(users)
      .where(inArray(users.user_id, distinctTelegramIds));

    const existingIds = new Set(existingUsers.map((row) => row.user_id));

    // 3) Build a list of those that do NOT exist
    const missingIds = distinctTelegramIds.filter((id) => !existingIds.has(id));
    logger.info(`Missing IDs for tournament #${tourney.id} =>`, missingIds);
    // 4) Bulk-insert them into 'users' with role = 'user'
    if (missingIds.length) {
      // Insert each missing ID
      await db.insert(users).values(
        missingIds.map((telegramId) => ({
          user_id: telegramId, // the primary key
          role: "user", // default role
          first_name: null,
          last_name: null,
          username: null,
          // any other fields can be left as defaults or null
        }))
      );
    }
  }

  // 5) Now proceed to insert participants into game_leaderboard
  const rowsToInsert = participants.map((p) => ({
    hostUserId: p.userId,
    telegramUserId: p.telegramId,
    tournamentId: tourney.id,
    gameId: tourney.gameId,
    hostTournamentId: tourney.hostTournamentId,
    nickname: p.nickname,
    position: p.position,
    points: p.points,
    matchId: p.matchId,
    endedAt: new Date(p.endedAt),
  }));

  await db
    .insert(gameLeaderboard)
    .values(rowsToInsert)
    .onConflictDoUpdate({
      // Columns that define the uniqueness conflict
      target: [gameLeaderboard.telegramUserId, gameLeaderboard.hostTournamentId],

      // How to update the other columns when a conflict occurs
      set: {
        nickname: sql`excluded.nickname`,
        position: sql`excluded.position`,
        points: sql`excluded.points`,

        // Use excluded.match_id, not matchId
        matchId: sql`excluded.match_id`,

        // Use excluded.ended_at, not endedAt
        endedAt: sql`excluded.ended_at`,
      },
    });
}

// Example interface for the result
interface MaxScoreResult {
  maxScore: number;
}

/**
 * Get a user's maximum leaderboard 'points' for a particular game & prize type
 * among all tournaments that started on or after the specified date.
 *
 * @param userId        - The user’s telegram user ID
 * @param gameId        - The ID of the game in your 'games' table
 * @param prizeType     - The prize type to filter by (e.g. 'Coin', 'None', etc.)
 * @param startDate     - The earliest tournament start date to consider
 * @returns number      - The max points the user has achieved in that scope (or 0 if none)
 */
export async function getUserMaxScoreInGameByPrizeTypeAfterDate(
  userId: number,
  gameId: number,
  prizeType: tournamentPrizeType,
  startDate: Date
): Promise<MaxScoreResult> {
  // 1) Build your query:
  // We select the MAX of game_leaderboard.points, joining tournaments
  // so we can filter on gameId, prizeType, and startDate
  const query = db
    .select({
      maxScore: sql<number>`MAX
          (${gameLeaderboard.points})`,
    })
    .from(gameLeaderboard)
    .innerJoin(tournaments, eq(gameLeaderboard.tournamentId, tournaments.id))
    .where(
      and(
        eq(gameLeaderboard.telegramUserId, userId),
        eq(tournaments.gameId, gameId),
        eq(tournaments.prizeType, prizeType),
        gte(tournaments.startDate, startDate)
      )
    );

  // 2) Execute the query
  const [res] = await query;

  // 3) Return the max score, defaulting to 0 if it's null or undefined
  return { maxScore: res?.maxScore ?? 0 };
}

const gameLeaderboardDB = {
  insertParticipantsToLeaderboard,
  getUserMaxScoreInGameByPrizeTypeAfterDate,
};
export default gameLeaderboardDB;
