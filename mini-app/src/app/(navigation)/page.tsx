"use client";
import EventCard from "@/app/_components/EventCard/EventCard";
import SearchBar from "@/app/_components/SearchBar/SearchBar";
import "@/app/page.css";
import EventBanner from "@/components/EventBanner";
import Typography from "@/components/Typography";
import { useConfig } from "@/context/ConfigContext";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import CustomCard from "../_components/atoms/cards/CustomCard";
import DataStatus from "../_components/molecules/alerts/DataStatus";
import { trpc } from "../_trpc/client";

import CustomSwiper from "../_components/CustomSwiper";
import EventsTimeline from "../_components/Event/EventsTImeline";
import EventCardSkeleton from "../_components/EventCard/EventCardSkeleton";

export default function Home() {
  return (
    <>
      <div className="flex flex-col pt-3">
        <div className="w-full pb-3">
          <SearchBar />
        </div>

        <div className=" flex-grow">
          <div className="flex-grow flex flex-col gap-6">
            {/* Slider Event */}
            <PromotedEventsSlider />
            <OngoingEvents />
            <UpcomingEvents />
          </div>
        </div>
      </div>
    </>
  );
}

function PromotedEventsSlider() {
  const config = useConfig();
  const event_uuids = (
    Array.isArray(config?.homeSliderEventUUID) ? config?.homeSliderEventUUID : [config?.homeSliderEventUUID]
  ).filter(Boolean);
  const eventCount = event_uuids.length;

  // Fetch parameters
  const sliderEventParams = {
    limit: 10,
    filter: {
      event_uuids: event_uuids as string[],
    },
    sortBy: "do_not_order" as const,
  };

  const {
    data: sliderEventData,
    isLoading: isLoadingSlider,
    isSuccess,
    isError,
  } = trpc.events.getEventsWithFilters.useQuery(sliderEventParams, {
    enabled: eventCount > 0,
    staleTime: Infinity,
  });

  // ------------ //
  //  🔴 ERROR    //
  // ------------ //
  if ((isSuccess && !sliderEventData?.data?.length) || isError) return null;

  // ------------ //
  //  🟡 LOADING  //
  // ------------ //
  let content = (
    <CustomSwiper>
      <EventBanner
        skeleton
        className="flex-[0_0_220px] h-[220px] !w-[220px]"
      />
      <EventBanner
        skeleton
        className="flex-[0_0_220px] h-[220px] !w-[220px]"
      />
      <EventBanner
        skeleton
        className="flex-[0_0_220px] h-[220px] !w-[220px]"
      />
    </CustomSwiper>
  );

  // ------------ //
  //  🟢 SUCCESS  //
  // ------------ //
  if (!isLoadingSlider) {
    content = (
      <CustomSwiper>
        {sliderEventData?.data.map((event) => (
          <EventBanner
            event={event}
            key={event.eventUuid}
          />
        ))}
      </CustomSwiper>
    );
  }

  return (
    <div>
      <Typography
        variant="title2"
        className="mb-3"
      >
        Featured Events{" "}
      </Typography>
      {content}
    </div>
  );
}

const OngoingEvents = () => {
  const ongoingEvents = trpc.events.getEventsWithFilters.useQuery(
    {
      filter: {
        eventStatus: "ongoing",
      },
      sortBy: "random",
      limit: 2,
    },
    {
      staleTime: Infinity,
    }
  );

  if (ongoingEvents.isSuccess && ongoingEvents.data?.totalCount === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full pb-2 flex justify-between items-center">
        <Typography variant="title2">
          Ongoing Events{ongoingEvents.data?.totalCount ? ` (${ongoingEvents.data?.totalCount})` : ""}
        </Typography>
        <Link
          href={"/search?" + new URLSearchParams({ eventStatus: "ongoing" }).toString()}
          className="text-primary font-medium flex align-center"
        >
          <span>Show more</span>
          <ChevronRightIcon
            width={20}
            className="ml-1 -my-0.5"
          />
        </Link>
      </div>
      {ongoingEvents.isError && (
        <CustomCard
          className="col-span-2"
          defaultPadding
        >
          <DataStatus
            status="searching"
            title={`Error${ongoingEvents.error instanceof Error ? `: ${ongoingEvents.error.name}` : ""}`}
            description={
              ongoingEvents.error instanceof Error ? ongoingEvents.error.message : "Error loading ongoing events."
            }
          />
        </CustomCard>
      )}
      {ongoingEvents.isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        ongoingEvents.data?.data?.map((event, idx) => (
          <EventCard
            key={idx}
            event={event}
          />
        ))
      )}
    </div>
  );
};

const UpcomingEvents = () => {
  const upcomingEvents = trpc.events.getEventsWithFilters.useQuery(
    {
      filter: {
        eventStatus: "upcoming",
      },
      sortBy: "start_date_asc",
      limit: 6,
    },
    {
      staleTime: Infinity,
    }
  );

  if (upcomingEvents.isError) {
    return (
      <CustomCard
        className="col-span-2"
        defaultPadding
      >
        <DataStatus
          status="searching"
          title={`Error${upcomingEvents.error instanceof Error ? `: ${upcomingEvents.error.name}` : ""}`}
          description={
            upcomingEvents.error instanceof Error ? upcomingEvents.error.message : "Error loading upcoming events."
          }
        />
      </CustomCard>
    );
  }

  if (upcomingEvents.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Typography variant="title2">Upcoming Events</Typography>
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  // if there were zero events don't show anything
  if (upcomingEvents.data?.totalCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full flex justify-between items-center">
        <Typography variant="title2">
          Upcoming Events{upcomingEvents.data?.totalCount ? `(${upcomingEvents.data?.totalCount})` : ""}
        </Typography>
        <Link
          href={
            "/search?" +
            new URLSearchParams({
              eventStatus: "upcoming",
            }).toString()
          }
          className="text-primary font-medium flex align-center"
        >
          <span>All Events</span>
          <ChevronRightIcon
            width={20}
            className="ml-1 -my-0.5"
          />
        </Link>
      </div>

      <EventsTimeline events={upcomingEvents.data.data} />
    </div>
  );
};
