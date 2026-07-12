"use client";

import EventPageLoadingSkeleton from "../../events/[hash]/loading";
import { EventDataProvider } from "./EventDataProvider";
import { useEventData } from "./eventPageContext";
import { EventSections } from "./EventPageSections";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const EventDataQueryState = () => {
  const { eventData } = useEventData();

  switch (true) {
    case eventData.isLoading:
      return <EventPageLoadingSkeleton />;
    default:
      return <EventSections />;
  }
};

export const EventDataPage = ({ eventHash }: { eventHash: string }) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return (
    <div className="bg-cn-background min-h-screen md:py-6">
      <EventDataProvider eventHash={eventHash}>
        <EventDataQueryState />
      </EventDataProvider>
    </div>
  );
};
