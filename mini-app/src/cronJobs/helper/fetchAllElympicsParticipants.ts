import { getTournamentLeaderboard } from "@/lib/elympicsApi";
import { GamerData } from "@/db/modules/games.db";
import { sleep } from "@/utils";
import { logger } from "@/server/utils/logger";

/**
 * 3) Use Elympics leaderboard pages to gather all participants
 */
export async function fetchAllElympicsParticipants(
  hostTournamentId: string,
  hostGameId: string | null
): Promise<GamerData[]> {
  const pageSize = 100;
  let pageNumber = 1;
  let allRows: GamerData[] = [];

  while (true) {
    // Call your getTournamentLeaderboard
    await sleep(100); // sleep  200ms between requests
    const lbData = await getTournamentLeaderboard(hostGameId, hostTournamentId, pageSize, pageNumber);
    if (!lbData.data.length) break;
    logger.info(`Elympics leaderboard page ${pageNumber} =>`, lbData.data.length);

    // Convert Elympics response to the shape we need
    const mapped = lbData.data.map((entry) => ({
      telegramId: parseInt(entry.telegramId, 10) || 0,
      userId: entry.userId,
      nickname: entry.nickname || undefined,
      position: entry.position,
      points: entry.points,
      matchId: entry.matchId,
      endedAt: entry.endedAt,
    }));

    allRows = allRows.concat(mapped);

    // If we've reached the end, or no more pages
    if (pageNumber >= lbData.totalPages) break;

    pageNumber++;
  }

  return allRows;
}
