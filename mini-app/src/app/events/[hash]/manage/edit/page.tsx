"use client";

import ManageEvent from "@/app/_components/organisms/events/ManageEvent";
import { useGetEvent } from "@/hooks/events.hooks";

interface CreateEventAdminPageProps {
  params: { hash: string };
}

export default function CreateEventAdminPage({ params }: CreateEventAdminPageProps) {
  const event = useGetEvent(params.hash);

  if (event.error) {
    return <div>Error: {event.error.message}</div>;
  }
  if (!event.data) {
    return <div>Loading event data...</div>;
  }

  const eventData = event.data;

  return (
    <div>
      <ManageEvent event={eventData} />
    </div>
  );
}
