import { db } from "@/db/db";
import { gamesDB } from "@/db/modules/games.db";
import { tournamentsDB } from "@/db/modules/tournaments.db";
import { getTournamentDetails } from "@/lib/elympicsApi"; // your existing function
import { logger } from "@/server/utils/logger";

/**
 * Update all relevant tournaments in the local DB by fetching data from Elympics.
 *
 * Logic:
 *  - We only update tournaments whose end date was <= 5 minutes ago or still in the future.
 *    (That means "EndDate > (now - 5 minutes)".)
 *  - For each tournament, we fetch from Elympics, then update DB.
 *  - If the Elympics data says it's "Active", set local state to "Active"; else "Concluded", etc.
 *
 * Call this function periodically via a cron job (e.g., every X minutes).
 */
export const updateAllTournaments = async () => {
  // 1) Calculate the cutoff time (currentTime - 5 minutes)
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);

  try {
    // 2) Get the list of tournaments that still need updates
    //    i.e., EndDate >= fiveMinutesAgo => means we haven't passed the "5 minutes after" threshold.
    const tournamentsToUpdate = await tournamentsDB.getTournamentsEndingAfter(fiveMinutesAgo);

    if (!tournamentsToUpdate || tournamentsToUpdate.length === 0) {
      logger.log("No tournaments to update at this time.");
      return;
    }

    logger.log(`Found ${tournamentsToUpdate.length} tournaments to update...`);

    for (const localTournament of tournamentsToUpdate) {
      try {
        // a) Fetch details from Elympics
        const tId = localTournament.tournaments.hostTournamentId; // e.g. "o17yuwmr"
        const details = await getTournamentDetails(tId);

        if (!details) {
          logger.error(`Tournament ${tId} not found in Elympics.`);
          continue;
        }

        // b) Validate or check that details.GameId matches the local record’s hostGameId if necessary
        if (localTournament.game?.hostGameId && localTournament.game.hostGameId !== details.GameId) {
          logger.error(
            `Tournament ${tId} mismatch GameId. Local = ${localTournament.game.hostGameId}, Elympics = ${details.GameId}`
          );
          continue;
        }

        // c) Update DB within a transaction
        await db.transaction(async (trx) => {
          // (i) Update the Game row if needed
          if (localTournament.game) {
            const gameRow = localTournament.game;
            const updatedGameData = {
              // Suppose we only update name, but you can also store raw JSON, or do logic on State, etc.
              // name: details.Name || gameRow.name,
              // For reference: gameRow.imageUrl might not need changes unless you have new info
              rawGameJson: details as any, // If you store raw JSON
            };
            await gamesDB.updateGameTx(trx, gameRow.hostGameId, updatedGameData);
          }

          // (ii) Update the local tournament row
          const updatedTourData = {
            name: details.Name,
            // If the Elympics State is "Active", we store "Active" else "Concluded" etc.
            state: details.State === "Active" ? "Active" : "Concluded",
            createDate: details.CreateDate ? new Date(details.CreateDate) : null,
            startDate: details.StartDate ? new Date(details.StartDate) : null,
            endDate: details.EndDate ? new Date(details.EndDate) : null,
            playersCount: details.PlayersCount,
            entryFee: details.EntryFee,
            tonEntryType: details.TonDetails?.EntryType === "Tickets" ? "Tickets" : "Pass",
            tonTournamentAddress: details.TonDetails?.TournamentAddress || null,
            prizeType: details.PrizeType === "Coin" ? "Coin" : "None",
            currentPrizePool: details.CurrentPrizePool,
            rawHostJson: details as any,
          };

          await tournamentsDB.updateTournamentTx(trx, localTournament.tournaments.id, updatedTourData);
        });

        logger.log(`Tournament ${tId}  ${details.Name} updated successfully!`);
      } catch (err) {
        logger.error(`Error updating tournament ${localTournament.tournaments.id}`, err);
      }
    }

    logger.log("All eligible tournaments updated!");
  } catch (err) {
    logger.error("Error in updateAllTournaments:", err);
  }
};
