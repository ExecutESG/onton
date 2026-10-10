import { TournamentsRow } from "@/db/schema/tournaments";

type TournamentEndDate = Pick<TournamentsRow, "activityId" | "endDate">;

export const extendTournamentEndDateIfNeeded = async (
  _tournament: TournamentEndDate,
  _extendedEndDateSec: number
): Promise<boolean> => {
  return false;
};

export const revertTournamentEndDateIfNeeded = async (_tournament: TournamentEndDate) => {
  return;
};

