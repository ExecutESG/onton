import { db } from "@/db/db";
import { tournaments } from "@/db/schema/tournaments";
import { gameLeaderboard } from "@/db/schema/gameLeaderboard";
import { eq, and, lt } from "drizzle-orm/expressions";
import { isNotNull, isNull, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { games } from "@/db/schema";
import { postTelegramCsvToTonSociety } from "@/cronJobs/helper/postTelegramCsvToTonSociety";
import { generateTelegramCsv } from "@/cronJobs/helper/generateTelegramCsv";
import { fetchAllElympicsParticipants } from "@/cronJobs/helper/fetchAllElympicsParticipants";
import gameLeaderboardDB from "@/db/modules/gameLeaderboard.db";
import {
  extendTournamentEndDateIfNeeded,
  revertTournamentEndDateIfNeeded,
} from "@/cronJobs/helper/tournamentRewards.helpers";

/**
 * 1) A helper that returns tournaments whose endDate is
 * between 5 minutes ago and 30 minutes ago
 */
export async function getJustEndedTournaments(): Promise<
  {
    id: number;
    gameId: number;
    hostTournamentId: string;
    activityId: number | null;
    hostGameId: string | null;
    endDate: Date | null;
  }[]
> {
  const now = new Date();
 
  const fiveMinAgo = new Date(now.getTime() - 150 * 86400_000); // 5 minutes ago
 

  // 1) Build the query, but don't execute yet
  const query = db
    .select({
      id: tournaments.id,
      gameId: tournaments.gameId,
      hostTournamentId: tournaments.hostTournamentId,
      activityId: tournaments.activityId,
      hostGameId: games.hostGameId,
      endDate: tournaments.endDate,
    })
    .from(tournaments)
    .innerJoin(games, eq(tournaments.gameId, games.id))
 
    // .where(and(lt(tournaments.endDate, fiveMinAgo), isNull(tournaments.rewardLink), isNotNull(tournaments.activityId)));
 
    .where(and(isNull(tournaments.rewardLink), isNotNull(tournaments.activityId)));
  //,
  // 2) Convert to SQL
  const compiled = query.toSQL();
  // compiled.sql => the SQL string
  // compiled.params => the array of parameters

  logger.info("getJustEndedTournaments SQL:", compiled.sql);
  logger.info("getJustEndedTournaments params:", compiled.params);

  // 3) Now execute the query
  const endedTournies = await query;
  logger.info("Just ended tournaments =>", endedTournies.length);

  return endedTournies;
}

/**
 * 2) Check if we already have ANY leaderboard records
 * for a given tournament (by ID in our local DB)
 */
async function hasLeaderboardRecords(tournamentId: number): Promise<boolean> {
  const [row] = await db
    .select({
      cnt: sql<number>`count
          (*)`,
    })
    .from(gameLeaderboard)
    .where(eq(gameLeaderboard.tournamentId, tournamentId));
  return (row?.cnt ?? 0) > 0;
}

/**
 * 7) The main function to be called by cron every X minutes
 */
export async function processRecentlyEndedTournaments() {
  // a) find tournaments ended 5-30 min ago
  const ended = await getJustEndedTournaments();
  if (!ended.length) {
    logger.info("No recently ended tournaments found.");
    return;
  }

  for (const t of ended) {
    if (!t.activityId) {
      logger.warn(`Tournament ID=${t.id} has no Ton Society activityId. Skipping...`);
      continue;
    }

    // b) check if we have local participants
    const hasRecords = await hasLeaderboardRecords(t.id);
    if (!hasRecords || 1) {
      // gather all participants from Elympics
      const participants = await fetchAllElympicsParticipants(t.hostTournamentId, t.hostGameId || null);

      if (participants.length) {
        logger.info(`Participants for tournament #${t.id} =>`, participants.length);
        await gameLeaderboardDB.insertParticipantsToLeaderboard(t, participants);
      } else {
        logger.info(`No Elympics participants found for tournament #${t.id} / hostTID=${t.hostTournamentId}`);
      }
    }

    // c) now get the final set of participants (post-insert) to generate CSV
    const finalRows = await db
      .select({ telegramId: gameLeaderboard.telegramUserId })
      .from(gameLeaderboard)
      .where(eq(gameLeaderboard.tournamentId, t.id));

    if (!finalRows.length) {
      logger.info(`No participants for tournament #${t.id} after insertion; skipping allowlist upload.`);
      continue;
    }

    logger.info(`Participants for tournament #${t.id} =>`, finalRows);

    // d) generate CSV
    const csvBuff = generateTelegramCsv(finalRows);

    const nowSec = Math.floor(Date.now() / 1000);
    const extendedEndDate = nowSec + 86400; // +1 day
    let didExtend = false;
    try {
      didExtend = await extendTournamentEndDateIfNeeded(t, extendedEndDate);
    } catch (err) {
      logger.error(`Failed to extend end_date for tournament #${t.id}`, err);
      continue;
    }

    try {
      // e) post to Ton Society => get reward_link
      const rewardLink = await postTelegramCsvToTonSociety(t.activityId, csvBuff);
      if (rewardLink) {
        await db.update(gameLeaderboard).set({ rewardCreated: true }).where(eq(gameLeaderboard.tournamentId, t.id));
        // save reward_link in tournaments table
        await db.update(tournaments).set({ rewardLink }).where(eq(tournaments.id, t.id));
        logger.info(`Tournament #${t.id} => reward_link saved: ${rewardLink}`);
      }
    } finally {
      if (didExtend) {
        try {
          await revertTournamentEndDateIfNeeded(t);
        } catch (err) {
          logger.error(`Failed to revert end_date for tournament #${t.id}`, err);
        }
      }
    }
  }
}
