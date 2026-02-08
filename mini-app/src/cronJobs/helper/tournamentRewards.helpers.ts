import { TournamentsRow } from "@/db/schema/tournaments";
import { timestampToIsoString } from "@/lib/DateAndTime";
import { updateActivity } from "@/lib/ton-society-api";
import { logger } from "@/server/utils/logger";

/**
 * Extends the tournament activity end_date on Ton Society if the current end date is in the past.
 * Returns true if the date was extended.
 */
type TournamentEndDate = Pick<TournamentsRow, "activityId" | "endDate">;

export const extendTournamentEndDateIfNeeded = async (
  tournament: TournamentEndDate,
  extendedEndDateSec: number
): Promise<boolean> => {
  const nowSec = Math.floor(Date.now() / 1000);
  const originalEndDateSec = tournament.endDate ? Math.floor(tournament.endDate.getTime() / 1000) : 0;

  if (tournament.activityId && tournament.endDate && originalEndDateSec < nowSec) {
    logger.log(
      `Extending end_date for tournament activity_id=${tournament.activityId} from ${originalEndDateSec} to ${extendedEndDateSec}`
    );
    await updateActivity({ end_date: timestampToIsoString(extendedEndDateSec) }, tournament.activityId);
    return true;
  }

  return false;
};

/**
 * Reverts the tournament activity end_date on Ton Society to the original date.
 */
export const revertTournamentEndDateIfNeeded = async (tournament: TournamentEndDate) => {
  if (!tournament.activityId || !tournament.endDate) return;
  const originalEndDateSec = Math.floor(tournament.endDate.getTime() / 1000);
  logger.log(
    `Reverting end_date for tournament activity_id=${tournament.activityId} back to ${originalEndDateSec}`
  );
  await updateActivity({ end_date: timestampToIsoString(originalEndDateSec) }, tournament.activityId);
};

