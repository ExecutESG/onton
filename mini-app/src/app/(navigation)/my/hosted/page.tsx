"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Section from "@/app/_components/atoms/section";
import CustomButton from "@/app/_components/Button/CustomButton";
import EventsTimeline from "@/app/_components/Event/EventsTImeline";
import SearchIcon from "@/app/_components/icons/search-icon";
import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import ContestsTimeline from "@/app/_components/myonton/participated/ContestsTImeline";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useWebApp from "@/hooks/useWebApp";
import { useDebouncedState } from "@mantine/hooks";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Page showing events and contests you host. ✨
 *
 * @returns JSX.Element
 */
export default function MyHostedPage() {
  const webApp = useWebApp();
  const userId = webApp?.initDataUnsafe?.user?.id;
  const [eventsSearch, setEventsSearch] = useDebouncedState("", 500);
  const [contestsSearch, setContestsSearch] = useDebouncedState("", 500);
  const [activeTab, setActiveTab] = useState("events");

  const eventsInfinite = trpc.events.getEventsWithFiltersInfinite.useInfiniteQuery(
    {
      filter: { organizer_user_id: userId },
      search: eventsSearch.length > 2 ? eventsSearch : "",
      limit: 10,
    },
    {
      enabled: Boolean(userId) && Boolean(activeTab === "events"),
      getNextPageParam(lastPage) {
        return lastPage.nextCursor;
      },
    }
  );

  const contestsInfinite = trpc.tournaments.getTournaments.useInfiniteQuery(
    {
      filter: {
        organizer_user_id: userId,
      },
      search: contestsSearch.length > 2 ? contestsSearch : "",
      limit: 10,
    },
    {
      enabled: Boolean(activeTab === "contests"),
      getNextPageParam(lastPage) {
        return lastPage.nextCursor;
      },
    }
  );

  const contests = useMemo(
    () => contestsInfinite.data?.pages.map((p) => p.tournaments).flat() ?? null,
    [contestsInfinite.data?.pages]
  );

  const events = useMemo(
    () => eventsInfinite.data?.pages.map((p) => p.items.eventsData).flat() ?? null,
    [eventsInfinite.data?.pages]
  );

  return (
    <div className="bg-brand-bg p-4 min-h-screen flex flex-col gap-4">
      <Tabs
        defaultValue="events"
        onValueChange={(v) => setActiveTab(v)}
      >
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="contests">Contests</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <Section>
            <Input
              className="bg-brand-light mt-2"
              placeholder="Search Events"
              prefix_icon={<SearchIcon />}
              onChange={(e) => {
                setEventsSearch(e.target.value);
              }}
            />
            <Typography variant="title2">Hosted Events ({eventsInfinite.data?.pages[0].items.rowsCount})</Typography>
            {/* if there were no events we show not found state */}
            {events?.length === 0 && (
              <CustomCard defaultPadding>
                <div className="flex flex-col gap-5">
                  <DataStatus
                    status="archive_duck"
                    title="It’s looking quiet here..."
                    description="Enter an Event and watch this space light up with your activity."
                    size="lg"
                  />
                  <Link
                    href="/"
                    prefetch
                  >
                    <CustomButton>Explore Events</CustomButton>
                  </Link>
                </div>
              </CustomCard>
            )}
            <EventsTimeline
              isLoading={eventsInfinite.isFetching}
              preserveDataOnFetching
              events={events}
            />
            {!eventsInfinite.isFetching && eventsInfinite.data?.pages.at(-1)?.nextCursor && (
              <CustomButton
                onClick={() => {
                  eventsInfinite.fetchNextPage();
                }}
                variant="link"
                fontSize="body"
                size="md"
              >
                Load 10 more results
              </CustomButton>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="contests">
          <Section>
            <Input
              className="bg-brand-light mt-2"
              placeholder="Search Contests"
              prefix_icon={<SearchIcon />}
              onChange={(e) => {
                setContestsSearch(e.target.value);
              }}
            />
            <Typography variant="title2">Hosted Contests</Typography>
            {/* if there were no contests we show not found state */}
            {contests?.length === 0 && (
              <CustomCard defaultPadding>
                <div className="flex flex-col gap-5">
                  <DataStatus
                    status="archive_duck"
                    title="It’s looking quiet here..."
                    description="Enter a contest and watch this space light up with your activity."
                    size="lg"
                  />
                  <Link
                    href="/play-2-win"
                    prefetch
                  >
                    <CustomButton>Explore Contests</CustomButton>
                  </Link>
                </div>
              </CustomCard>
            )}
            <ContestsTimeline
              tournaments={contests}
              isLoading={contestsInfinite.isFetching}
            />
            {!contestsInfinite.isFetching && contestsInfinite.data?.pages.at(-1)?.nextCursor && (
              <CustomButton
                onClick={(e) => {
                  contestsInfinite.fetchNextPage();
                }}
                variant="link"
                fontSize="body"
                size="md"
              >
                Load 10 more results
              </CustomButton>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
