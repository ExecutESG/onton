"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { cn } from "@/lib/utils";
import Skeleton from "@mui/material/Skeleton";
import Image from "next/image";
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  points: number;
  avatar: string | null;
  position: number;
}

interface LeaderboardProps {
  bestScore: number;
  timesPlayed: number;
  position: string;
  participants: Participant[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ participants = [] }) => {
  const topThreeParticipants = participants.slice(0, 3);
  const remainingParticipants = participants.slice(3);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Leaderboard Section */}
      <CustomCard className="mb-6">
        <div className="p-4">
          <Typography
            variant="title3"
            weight="semibold"
            className="mb-2"
          >
            LeaderBoard
          </Typography>

          <Typography
            variant="body"
            weight="normal"
            className="text-gray-500 mb-4"
          >
            Points and Places each participant (Including you) claimed in this quest
          </Typography>

          {/* Top 3 Participants */}
          <div className="flex justify-between items-end mb-6 bg-[#C8C7CB33] rounded-[30px] p-4">
            {(() => {
              const reorderedTopThree =
                topThreeParticipants.length === 3
                  ? [topThreeParticipants[1], topThreeParticipants[0], topThreeParticipants[2]]
                  : topThreeParticipants;
              return reorderedTopThree.map((participant, index) => {
                const isWinner = index === 1;
                return (
                  <div
                    key={participant.id}
                    className="flex flex-col items-center isolate relative min-w-0 flex-1"
                  >
                    {isWinner && <div className="-top-3.5 z-10 absolute -rotate-[35deg] left-3 text-2xl">👑</div>}

                    <div
                      className={cn(
                        "relative rounded-full overflow-hidden border-2",
                        isWinner ? "w-16 h-16 border-blue-500" : "w-14 h-14 border-transparent"
                      )}
                    >
                      <Image
                        src={participant.avatar || "/template-images/user-placeholder.png"}
                        alt={participant.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <Typography
                      variant="footnote"
                      truncate
                      className="w-full text-center"
                    >
                      {participant.name}
                    </Typography>

                    <div
                      className={cn(
                        "mt-1 px-3 py-0.5 rounded-full text-center",
                        isWinner ? "bg-blue-500 text-white" : "text-black"
                      )}
                    >
                      <Typography
                        variant="caption1"
                        weight="medium"
                      >
                        {participant.points} Points
                      </Typography>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Remaining Participants */}
          <div className="space-y-3">
            {remainingParticipants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Typography
                    variant="footnote"
                    weight="medium"
                    className="text-gray-500 text-nowrap"
                  >
                    {participant.position}
                    <sup>th</sup>
                  </Typography>

                  <div className="min-w-8 min-h-8 rounded-full overflow-hidden">
                    <Image
                      src={participant.avatar || "/template-images/user-placeholder.png"}
                      alt={participant.name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>

                  <Typography
                    variant="body"
                    weight="medium"
                    truncate
                  >
                    {participant.name}
                  </Typography>
                </div>

                <div className="flex flex-col items-center">
                  <Typography
                    variant="caption1"
                    weight="light"
                    className="text-gray-500"
                  >
                    Points
                  </Typography>
                  <Typography
                    variant="headline"
                    weight="semibold"
                  >
                    {participant.points}
                  </Typography>
                </div>
              </div>
            ))}

            {/* Reward Zone Indicator */}
            {/* <div className="flex justify-center items-center py-2">
              <div className="flex items-center gap-2 text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                <Typography
                  variant="footnote"
                  weight="normal"
                >
                  Reward Zone
                </Typography>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
            </div> */}
          </div>
        </div>
      </CustomCard>
    </div>
  );
};

export default function LeaderboardPage() {
  const params = useParams<{ "play-id": string }>();

  const leaderboard = trpc.tournaments.getTournamentLeaderboard.useInfiniteQuery(
    {
      tournamentId: Number(params["play-id"]),
      limit: 30,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !isNaN(Number(params["play-id"])),
    }
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = leaderboard;

  const participants: Participant[] = useMemo(() => {
    const list: Participant[] = [];

    leaderboard.data?.pages.forEach((page) => {
      page.leaderboard.forEach((p) => {
        list.push({
          id: p.userId,
          name: p.first_name,
          points: p.points,
          avatar: p.photo_url,
          position: p.position,
        });
      });
    });

    return list;
  }, [leaderboard.data?.pages.length]);

  // Sentinel element ref for infinite scrolling
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render skeleton on first load
  if (leaderboard.isLoading && !leaderboard.data) {
    return (
      <div className="w-full max-w-md mx-auto p-4 bg-gray-100 min-h-screen">
        <CustomCard className="mb-6 p-4">
          {/* LeaderBoard Header Skeleton */}
          <Skeleton
            variant="text"
            width={120}
            height={24}
            className="mb-2"
          />
          <Skeleton
            variant="text"
            width="80%"
            height={16}
            className="mb-4"
          />

          {/* Top Three Participants Skeleton */}
          <div className="flex justify-between items-end mb-6 bg-[#C8C7CB33] rounded-[30px] p-4">
            {Array(3)
              .fill(0)
              .map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center relative"
                >
                  {index === 1 && (
                    <Skeleton
                      variant="text"
                      width={30}
                      height={30}
                      className="-top-4 absolute -rotate-[35deg] left-1"
                    />
                  )}
                  <Skeleton
                    variant="circular"
                    width={index === 1 ? 64 : 56}
                    height={index === 1 ? 64 : 56}
                    className={index === 1 ? "border-2 border-blue-500" : "border-2 border-transparent"}
                  />
                  <Skeleton
                    variant="rectangular"
                    width={50}
                    height={20}
                    className={index === 1 ? "mt-1 rounded-full bg-blue-500" : "mt-1 rounded-full"}
                  />
                </div>
              ))}
          </div>

          {/* Remaining Participants Skeleton */}
          <div className="space-y-3">
            {Array(3)
              .fill(0)
              .map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton
                      variant="text"
                      width={30}
                      height={16}
                    />
                    <Skeleton
                      variant="circular"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                    <Skeleton
                      variant="text"
                      width={100}
                      height={16}
                    />
                  </div>
                  <Skeleton
                    variant="text"
                    width={30}
                    height={16}
                  />
                </div>
              ))}
          </div>
        </CustomCard>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <Leaderboard
        bestScore={121}
        timesPlayed={2}
        position="1: 2"
        participants={
          participants.length < 3
            ? [
                ...participants,
                ...Array.from({ length: 3 - participants.length }, (_, i) => ({
                  id: `placeholder-${i}`,
                  name: "Placeholder",
                  points: 0,
                  avatar: null,
                  position: participants.length + i + 1,
                })),
              ]
            : participants
        }
      />

      {/* Sentinel element for triggering fetchNextPage */}
      <div
        ref={loadMoreRef}
        className="h-8 flex justify-center items-center"
      >
        {isFetchingNextPage ? (
          <span>Loading more...</span>
        ) : hasNextPage ? (
          <span>Scroll to load more</span>
        ) : (
          <span>No more data</span>
        )}
      </div>
    </div>
  );
}
