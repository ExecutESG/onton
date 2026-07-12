"use client";
import EventCard from "@/app/_components/EventCard/EventCard";
import EventCardSkeleton from "@/app/_components/EventCard/EventCardSkeleton";
import SearchBar from "@/app/_components/SearchBar/SearchBar";
import { trpc } from "@/app/_trpc/client";
import { useUserStore } from "@/context/store/user.store";
import { Block } from "konsta/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import parseSearchParams from "./parseSearchParams";

/** The maximum number of items per page */
const LIMIT = 5;

export default function Search() {
  const searchParams = useSearchParams();
  const { user } = useUserStore();

  // For the infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);

  const searchInput = parseSearchParams(searchParams);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.events.getEventsWithFiltersInfinite.useInfiniteQuery(
      {
        ...searchInput,
        limit: LIMIT,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      }
    );

  // Combine all pages of data into one array
  const allEvents = data?.pages.flatMap((page) => page.items.eventsData) ?? [];

  /**
   * IntersectionObserver that triggers fetchNextPage()
   * whenever the user scrolls near the bottom
   */
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    // Mark the last event in the UI with a unique class so we can attach observer
    const lastElement = document.querySelector(`.last-event-card`);
    if (lastElement) {
      observerRef.current.observe(lastElement);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [allEvents, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Block
      className="bg-[#EFEFF4] min-h-screen py-3 md:py-6"
      margin="0"
    >
      <div className="flex flex-col mx-auto max-w-xl w-full md:shadow-md md:border md:border-gray-200 dark:md:border-gray-800 md:bg-white md:p-4 md:rounded-2xl">
        {/* Sticky top bar with SearchBar & TabTriggers */}
        <div className="w-full pb-3">
          <SearchBar />
        </div>

        {/* Scrollable area containing the Swiper slides */}
        <div className="overflow-y-auto flex-grow">
          {/* Show skeleton if loading and no data */}
          {allEvents.length === 0 ? (
            isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: LIMIT }).map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-4">
                <Image
                  src="/template-images/no-search-result.gif"
                  alt="No search results found"
                  width={180}
                  height={180}
                />
                <div className="text-gray-500 max-w-md">
                  No Events were found
                  <br />
                  matching your Search.
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2">
              {allEvents.map((event, eventIndex) => {
                // Mark the last 1-2 events with a special class for IntersectionObserver
                const isNearEnd = eventIndex === allEvents.length - 1 || eventIndex === allEvents.length - 2;

                return (
                  <div
                    key={event.eventId}
                    className={isNearEnd ? `last-event-card` : ""}
                  >
                    <EventCard event={event} />
                  </div>
                );
              })}
              {isFetchingNextPage && hasNextPage && (
                <div className="text-center py-4 pb-5 w-full">
                  <div className="loader">Loading results...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Block>
  );
}
