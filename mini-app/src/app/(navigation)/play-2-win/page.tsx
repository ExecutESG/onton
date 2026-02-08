"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import { FloatingBadge } from "@/app/_components/Badge/FloatingBadge";
import CustomButton from "@/app/_components/Button/CustomButton";
import CustomSwiper from "@/app/_components/CustomSwiper";
import FeaturedBanners from "@/app/_components/FeaturedBanners";
import FilterIcon from "@/app/_components/icons/filter-icon";
import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import { TournamentTimeRemaining } from "@/app/_components/Tournament/TournamentRemainingTime";
import TournamentCard from "@/app/_components/Tournaments/TournamentCard";
import { trpc } from "@/app/_trpc/client";
import Divider from "@/components/Divider";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RouterOutput } from "@/server";
import { formatSortTournamentSelectOption, SortOptions, tournamentsListSortOptions } from "@/server/utils/tournaments.utils";
import { cn } from "@/utils";
import { Skeleton } from "@mui/material";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { HiOutlineArrowNarrowUp } from "react-icons/hi";

interface TournamentCardProps {
  tournament: RouterOutput["tournaments"]["getFeaturedTournaments"][0];
}

const TournamentSlide: React.FC<TournamentCardProps> = ({ tournament }) => {
  const router = useRouter();

  return (
    <div className="relative isolate w-[220px] h-[220px]">
      <LoadableImage
        src={tournament.imageUrl}
        key={tournament.id}
        width={220}
        height={220}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(`/play-2-win/${tournament.id}`);
        }}
        className="w-[220px] h-[220px] rounded-md hover:cursor-pointer"
        alt="tournament image card"
      />
      <TournamentTimeRemaining
        space="sm"
        closeOnly
        endDate={tournament.endDate!}
      />
      <FloatingBadge position={"bc-md"}>
        <Typography variant="caption2">+{tournament.playersCount} joined</Typography>
      </FloatingBadge>
    </div>
  );
};

const Play2WinFeatured = () => {
  const featuredEvents = trpc.tournaments.getFeaturedTournaments.useQuery();

  // if error or no result return null
  if (featuredEvents.isError || (featuredEvents.isSuccess && !featuredEvents.data.length)) {
    return;
  }

  return (
    <>
      <FeaturedBanners />
      <Typography variant="title2">Featured Contests</Typography>
      <div>
        <CustomSwiper>
          {featuredEvents.isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="rounded-md"
                  height={220}
                  width={220}
                  sx={{ transform: "unset" }}
                />
              ))
            : featuredEvents.data.map((tournament) => (
                <TournamentSlide
                  tournament={tournament}
                  key={tournament.id}
                />
              ))}
        </CustomSwiper>
      </div>
    </>
  );
};

const TournamentFilter: React.FC<{
  selected: SortOptions;
  setSelected: (s: SortOptions) => void;
  selectedGame: number;
  setSelectedGame: (g: number) => void;
}> = ({ selected, setSelected, selectedGame, setSelectedGame }) => {
  const gameIds = trpc.tournaments.getGameIds.useQuery();

  return (
    <div className="grid grid-cols-2 gap-3">
      <DropdownMenu>
        <Typography
          variant={"body"}
          weight={"medium"}
        >
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-1 bg-brand-light rounded-md py-1 px-2 justify-between">
              <HiOutlineArrowNarrowUp />
              <span className="truncate">{formatSortTournamentSelectOption(selected)}</span>
              <FilterIcon />
            </button>
          </DropdownMenuTrigger>
        </Typography>
        <DropdownMenuContent className="!bg-brand-light px-2 border-brand-divider-dark border-solid !border w-full">
          <Typography
            variant="body"
            weight="medium"
            className="px-2 pt-2"
          >
            Sort By
          </Typography>
          <Divider
            className="my-1"
            color={"dark"}
            height={"1"}
          />
          {tournamentsListSortOptions.map((o) => {
            return (
              <DropdownMenuItem
                key={o}
                onClick={(e) => {
                  e.preventDefault();
                  setSelected(o);
                }}
                className={cn("flex justify-between items-center px-0", selected === o && "text-primary")}
              >
                <Typography
                  variant="body"
                  weight="medium"
                  className="flex gap-1 items-center"
                >
                  <HiOutlineArrowNarrowUp />
                  {formatSortTournamentSelectOption(o)}
                </Typography>
                <CheckIcon
                  strokeWidth={3}
                  className={cn(selected !== o && "opacity-0")}
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <Typography
          variant={"body"}
          weight={"medium"}
        >
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-1 bg-brand-light rounded-md py-1 px-2 justify-between">
              <span className="truncate">{gameIds.data?.find((g) => g.id === selectedGame)?.name}</span>
              <FilterIcon />
            </button>
          </DropdownMenuTrigger>
        </Typography>
        <DropdownMenuContent
          border="dark"
          borderRadius="md"
          fullWidth
          className="px-2 !bg-brand-light"
        >
          <Typography
            variant="body"
            weight="medium"
            className="px-2 pt-2"
          >
            Contest type
          </Typography>
          <Divider
            className="my-1"
            color={"dark"}
            height={"1"}
          />
          {gameIds.data?.toReversed().map((game) => {
            return (
              <DropdownMenuItem
                key={game.id}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedGame(game.id);
                }}
                className={cn("flex justify-between items-center px-0", selectedGame === game.id && "text-primary")}
              >
                <Typography
                  variant="body"
                  weight="medium"
                >
                  {game.name}
                </Typography>
                <CheckIcon
                  size={12}
                  strokeWidth={3}
                  className={cn(selectedGame !== game.id && "opacity-0")}
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const DiscoverTournaments: React.FC = () => {
  const [sortSelected, setSortSelected] = React.useState<SortOptions>("timeRemaining");
  const [selectedGame, setSelectedGame] = useState(-1);

  const tournomants = trpc.tournaments.getTournaments.useInfiniteQuery(
    {
      limit: 50,
      filter: {
        status: "notended",
        gameId: selectedGame,
      },
      sortBy: sortSelected,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  return (
    <>
      <Typography variant="title2">Discover</Typography>
      {/* Sort dropdown */}
      <TournamentFilter
        selected={sortSelected}
        setSelected={(o) => {
          setSortSelected(o);
        }}
        selectedGame={selectedGame}
        setSelectedGame={setSelectedGame}
      />

      <div className="grid grid-cols-[repeat(auto-fill,_minmax(160px,_1fr))] gap-4 h-full flex-grow">
        {tournomants.isSuccess && !tournomants.data?.pages[0].tournaments.length && (
          <CustomCard
            defaultPadding
            className="col-span-full"
          >
            <div className="flex flex-col justify-center items-center gap-5 h-full">
              <DataStatus
                status="not_found"
                title="No result found"
                description="Try different keywords or filter to explore contests"
                size="lg"
              />
              {(selectedGame !== -1 || sortSelected !== "timeRemaining") && (
                <CustomButton
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedGame(-1);
                    setSortSelected("timeRemaining");
                  }}
                >
                  Clear Filters
                </CustomButton>
              )}
            </div>
          </CustomCard>
        )}
        {tournomants.isError && (
          <CustomCard
            defaultPadding
            className="col-span-full"
          >
            <DataStatus
              status="searching"
              title={`Error${tournomants.error instanceof Error ? `: ${tournomants.error.name}` : ""}`}
              description={tournomants.error instanceof Error ? tournomants.error.message : "Error loading results."}
              size="lg"
            />
          </CustomCard>
        )}
        {tournomants.isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-md p-4 flex flex-col gap-3 items-center"
              >
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={120}
                  className="rounded-md w-full"
                />
                <Skeleton
                  variant="rectangular"
                  width={80}
                  height={36}
                  className="rounded-md w-full mt-2"
                />
              </div>
            ))
          : tournomants.data?.pages.map((page) =>
              page.tournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                />
              ))
            )}
      </div>
    </>
  );
};

/**
 * @component PlayToWin
 *
 * @description
 * This component renders the Play2Win page containing both the featured contests
 * and the discover tournaments sections.
 *
 * @default
 * 😎🚀✨ This is the default export of the PlayToWin page component!
 */
const PlayToWin: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      <Play2WinFeatured />
      <DiscoverTournaments />
    </div>
  );
};

export default PlayToWin;
