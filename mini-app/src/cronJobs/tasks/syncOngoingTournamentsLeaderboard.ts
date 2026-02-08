import { getOngoingTournaments } from "@/db/modules/tournaments.db";
import { fetchAllElympicsParticipants } from "@/cronJobs/helper/fetchAllElympicsParticipants";
import gameLeaderboardDB from "@/db/modules/gameLeaderboard.db";
// ^-- Example import; adjust path to wherever your insertParticipantsToLeaderboard is defined

import { logger } from "@/server/utils/logger";

// Main function
export async function syncOngoingTournamentsLeaderboard() {
  // 1. Fetch all ongoing tournaments
  const ongoingTournaments = await getOngoingTournaments();
  logger.info(`Found ${ongoingTournaments.length} ongoing tournaments`);

  // 2. For each tournament, fetch participants and call insertParticipantsToLeaderboard
  for (const tourney of ongoingTournaments) {
    // Fetch participants from Elympics
    const participants = await fetchAllElympicsParticipants(tourney.hostTournamentId, tourney.hostGameId);
    logger.info(`Fetched ${participants.length} participants for tournament ID: ${tourney.id}`);

    // If no participants, skip to the next tournament
    if (participants.length === 0) continue;

    // 3. Insert (upsert) the participants into your leaderboard
    await gameLeaderboardDB.insertParticipantsToLeaderboard(tourney, participants);
    logger.info(`Inserted/upserted leaderboard data for tourney ID: ${tourney.id}`);
  }

  logger.info(`Completed leaderboard sync for all ongoing tournaments`);
}
