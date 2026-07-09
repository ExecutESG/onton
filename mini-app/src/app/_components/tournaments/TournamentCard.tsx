import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import CustomButton from "@/app/_components/Button/CustomButton";
import { TournamentTimeRemaining } from "@/app/_components/Tournament/TournamentRemainingTime";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import { RouterOutput } from "@/server";
import Link from "next/link";
import React from "react";

interface TournamentCardProps {
  tournament:
    | RouterOutput["tournaments"]["getTournaments"]["tournaments"][number]
    | RouterOutput["tournaments"]["getFeaturedTournaments"][number];
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  const webApp = useWebApp();

  return (
    <Link
      href={`/play-2-win/${tournament.id}`}
      className="block w-full"
    >
      <CustomCard
        defaultPadding
        className="w-full"
      >
        <div className="flex flex-col gap-3">
          <div className="relative isolate mx-auto">
            {tournament.imageUrl && (
              <LoadableImage
                src={tournament.imageUrl}
                width={120}
                height={120}
                className="min-w-[120px] min-h-[120px]"
                alt="game card"
              />
            )}
            {tournament.endDate && (
              <TournamentTimeRemaining
                closeOnly
                space="sm"
                endDate={tournament.endDate as unknown as string}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5 max-w-[136px]">
              <Typography
                variant="callout"
                truncate
              >
                {tournament.name}
              </Typography>
            </div>
            <div className="flex items-center justify-between">
              <CustomButton
                variant="outline"
                size="md"
                onClick={() => {
                  tournament.tournamentLink && webApp?.openTelegramLink(tournament.tournamentLink);
                }}
              >
                Play
              </CustomButton>
            </div>
          </div>
        </div>
      </CustomCard>
    </Link>
  );
};

export default TournamentCard;
