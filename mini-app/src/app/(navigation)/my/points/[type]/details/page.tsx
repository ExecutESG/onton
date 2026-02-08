"use client";

import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import { AffiliateDetailCard } from "@/app/_components/myonton/points/AffiliateDetailCard";
import EventPointDetailCard from "@/app/_components/myonton/points/PointDetailCard";
import { getNotFoundTitle, getTitle, isPointEventItem } from "@/app/_components/myonton/points/points.utils";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScoreItem } from "@/db/modules/userScore.db";
import type { UsersScoreActivityType } from "@/db/schema/usersScore";
import { EventWithScoreAndReward } from "@/types/event.types";
import { Skeleton } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FaSpinner } from "react-icons/fa6";
import { IoInformationCircle } from "react-icons/io5";

// @ts-expect-error - this is a type guard
function isEventItem(item: ScoreItem): item is EventWithScoreAndReward {
  return (item as any).eventId !== undefined;
}

// @ts-expect-error - this is a type guard
function isAffiliateItem(item: ScoreItem): item is JoinOntonAffiliateScore {
  return "id" in item && !("eventId" in item);
}

const MyPointsDetailsPage = () => {
  const { type } = useParams();
  const router = useRouter();

  const scoreDetails = trpc.usersScore.getScoreDetail.useInfiniteQuery(
    {
      limit: 10,
      activityType: type as UsersScoreActivityType,
    },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor ?? null,
    }
  );

  useEffect(() => {
    if (scoreDetails.isError && scoreDetails.error.data?.httpStatus === 404) {
      router.push("/my/points");
    }
  }, [scoreDetails.isError, router]);

  return (
    <div className="p-4 flex flex-col gap-4">
      <Typography variant="title3">{getTitle(type as UsersScoreActivityType)}</Typography>
      <div>
        <Alert variant={"info"}>
          <IoInformationCircle
            size={24}
            className="text-info-dark flex-shrink-0"
          />
          {isPointEventItem(type as UsersScoreActivityType) ? (
            <p>
              Your points refresh every 3 hour for 3 weeks. If your event has just wrapped up, hang tight—you'll see your
              points credited soon!
            </p>
          ) : (
            <p>Only new users can earn you points, if they are already joined ONTON, they will not earn you points.</p>
          )}
        </Alert>
      </div>
      {scoreDetails.isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton
            variant="rounded"
            height={100}
          />
          <Skeleton
            variant="rounded"
            height={100}
          />
          <Skeleton
            variant="rounded"
            height={100}
          />
        </div>
      )}

      {scoreDetails.isSuccess && (
        <div className="flex flex-col gap-2">
          {(scoreDetails.data.pages as { items: ScoreItem[] }[]) // <- cast once
            .flatMap((p) => p.items) // now items is ScoreItem
            .filter(isEventItem) // type-guard
            .map((points) => (
              <EventPointDetailCard
                key={`${points.userScoreId ?? 0}-${points.rewardId ?? "0"}-${points.eventId}`}
                eventId={points.eventId}
                eventUUID={points.eventUuid}
                imageUrl={points.imageUrl}
                eventTitle={points.eventTitle}
                eventStartDate={points.eventStartDate}
                eventEndDate={points.eventEndDate}
                tonSocietyStatus={points.tonSocietyStatus}
                userClaimedPoints={points.userClaimedPoints}
                rewardLink={points.rewardLink}
              />
            ))}
        </div>
      )}
      {scoreDetails.isSuccess && (
        <div className="flex flex-col gap-2">
          {scoreDetails.data.pages
            .flatMap((p) => p?.items ?? [])
            .filter(isAffiliateItem)
            .map((row) => (
              <AffiliateDetailCard
                key={row.id}
                data={row}
              />
            ))}
        </div>
      )}
      {/* Empty State */}
      {scoreDetails.isSuccess && (scoreDetails.data?.pages ?? []).flatMap((page) => page?.items ?? []).length === 0 && (
        <DataStatus
          status="not_found"
          size="lg"
          title={getNotFoundTitle(type as UsersScoreActivityType)}
          description="Earn points by enjoying various activities on ONTON"
          actionButton={
            <Link
              href="/"
              className="w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full"
              >
                Explore Events
              </Button>
            </Link>
          }
        />
      )}

      {/* Load more if there are more items */}
      {scoreDetails.isSuccess && scoreDetails.hasNextPage && (
        <Button
          variant="link"
          className="flex items-center gap-1 rounded-md flex-1 mx-auto max-w-[96px] text-primary font-medium"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            scoreDetails.fetchNextPage();
          }}
          disabled={scoreDetails.isFetchingNextPage}
        >
          {scoreDetails.isFetchingNextPage ? (
            <div className="flex items-center gap-2">
              <FaSpinner
                className="w-4 h-4 animate-spin"
                size={16}
              />
              <span>Loading...</span>
            </div>
          ) : (
            "Load more"
          )}
        </Button>
      )}
    </div>
  );
};

export default MyPointsDetailsPage;
