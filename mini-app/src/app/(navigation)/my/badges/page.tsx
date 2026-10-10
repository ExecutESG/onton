"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useUserStore } from "@/context/store/user.store";
import LoginRequired from "@/app/_components/auth/LoginRequired";
import { useWithBackButton } from "@/app/_components/atoms/buttons/web-app/useWithBackButton";
import { trpc } from "@/app/_trpc/client";
import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import CustomButton from "@/app/_components/Button/CustomButton";
import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import Typography from "@/components/Typography";
import BadgeDetailModal, { BadgeItemData, parseDate } from "@/components/sbt/BadgeDetailModal";
import ConsentCard from "@/components/consent/ConsentCard";

export default function MyBadgesPage() {
  const { user } = useUserStore();
  const router = useRouter();
  useWithBackButton({ whereTo: "/my" });

  const [selectedBadge, setSelectedBadge] = useState<BadgeItemData | null>(null);

  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = trpc.sbt.getUserBadges.useInfiniteQuery(
    { userId: user?.user_id ?? 0, limit: 20 },
    {
      enabled: Boolean(user?.user_id),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const badges = useMemo(
    () => data?.pages.flatMap((page) => page.badges) ?? [],
    [data?.pages]
  );
  const totalCount = data?.pages[0]?.totalCount ?? badges.length;

  if (!user) {
    return <LoginRequired />;
  }

  return (
    <div className="bg-brand-bg min-h-screen p-4 flex flex-col gap-4 max-w-xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => router.push("/my")}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
          aria-label="Back to Profile"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <Typography variant="title2" bold>
              My Badges
            </Typography>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {isLoading ? "..." : totalCount}
            </span>
          </div>
          <Typography variant="subheadline2" className="text-gray-500 dark:text-gray-400 text-xs">
            Verifiable Soulbound Proof of Attendance (TEP-85)
          </Typography>
        </div>
      </div>

      {/* GDPR Data & Privacy Consents */}
      <ConsentCard />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-gray-100 dark:border-neutral-800 flex flex-col gap-2"
            >
              <div className="w-full aspect-square bg-gray-200 dark:bg-neutral-800 rounded-xl" />
              <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-neutral-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && badges.length === 0 && (
        <CustomCard defaultPadding className="w-full !mx-0">
          <div className="flex flex-col gap-5 py-6">
            <DataStatus
              status="archive_duck"
              title="No Badges Collected Yet"
              description="Attend ONTON events to collect verifiable on-chain Soulbound Proof of Attendance badges."
              size="lg"
            />
            <Link href="/" prefetch className="w-full">
              <CustomButton className="w-full">Explore Events</CustomButton>
            </Link>
          </div>
        </CustomCard>
      )}

      {/* Badges Grid */}
      {!isLoading && badges.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {badges.map((badge) => {
            const metadata = ((badge.metadata || (badge as any).metadataJson) as Record<string, any>) || {};
            const title = metadata.name || badge.eventTitle || `Badge #${badge.itemIndex + 1}`;
            const image =
              metadata.image || badge.eventImage || "https://dev-storage.dev.onton.live/ontonimage/approved.lottie";

            const parsedDate = parseDate(badge.eventDateFrom || badge.eventStartDate);
            const formattedDate = parsedDate
              ? parsedDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge as BadgeItemData)}
                className="group cursor-pointer bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-gray-100 dark:border-neutral-800 hover:border-blue-400/50 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all flex flex-col gap-2.5 relative isolate overflow-hidden"
              >
                {/* Artwork */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center border border-gray-100 dark:border-neutral-800">
                  {image.endsWith(".lottie") || image.endsWith(".json") ? (
                    <div className="text-3xl">🎖️</div>
                  ) : (
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  )}
                  {/* Provenance Pill on top of artwork */}
                  {badge.kind === "legacy_onchain" ? (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-purple-400 font-medium border border-purple-500/30">
                      <Award className="w-3 h-3" />
                      <span>On-chain (legacy)</span>
                    </div>
                  ) : badge.kind === "legacy_record" || (badge.isTonSociety && !badge.itemAddress) ? (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-amber-400 font-medium border border-amber-500/30">
                      <Award className="w-3 h-3" />
                      <span>Attendance record (legacy)</span>
                    </div>
                  ) : (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-emerald-400 font-medium border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" />
                      <span>TEP-85</span>
                    </div>
                  )}
                </div>

                {/* Badge Info */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {title}
                  </span>
                  {badge.eventTitle && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                      {badge.eventTitle}
                    </span>
                  )}
                  {formattedDate && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 pt-0.5">
                      {formattedDate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isFetchingNextPage ? "Loading more..." : "Load More"}</span>
          </button>
        </div>
      )}

      {/* Badge Detail Modal */}
      <BadgeDetailModal
        badge={selectedBadge}
        open={Boolean(selectedBadge)}
        onClose={() => setSelectedBadge(null)}
        onUpgradeSuccess={() => refetch()}
      />
    </div>
  );
}
