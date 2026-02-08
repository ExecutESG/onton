"use client";

import GuestList from "@/app/_components/organisms/events/GuestList";
import { useGetEvent } from "@/hooks/events.hooks";
import { useParams } from "next/navigation";

export default function GuestListPage() {
  const { hash } = useParams() as { hash?: string };
  const { data: eventData, isLoading, isError } = useGetEvent(hash);
  if (isError) {
    return <div>something went wrong</div>;
  }
  if (!eventData?.event_uuid || isLoading) {
    return <div>Loading...</div>;
  }
  return (
    <div>
      <GuestList
        event={eventData}
        params={{ hash: eventData.event_uuid }} // If your component needs it
      />
    </div>
  );
}
