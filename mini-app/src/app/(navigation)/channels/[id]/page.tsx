"use client";
import ActionCard from "@/ActionCard";
import ChannelInfoCard from "@/app/_components/channels/ChannelInfoCard";
import ticketIcon from "@/app/_components/icons/ticket.svg";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";

type Props = { params: { id: string } };

export default function ChannelPage({ params }: Props) {
  const { data, isLoading, isError } = trpc.organizers.getOrganizer.useQuery({ user_id: Number(params.id) });

  const router = useRouter();

  if (isLoading) return null;
  if (isError) return "something went wrong...";

  return (
    <div className="min-h-screen bg-[#efeff4] pt-4">
      <ChannelInfoCard data={data} />

      <div className="px-4">
        <ActionCard
          onClick={(e) => {
            router.push(`/channels/${params.id}/events`);
          }}
          iconSrc={ticketIcon}
          subtitle="Visit organizer events"
          title="Events"
          footerTexts={[{ count: data.hosted_event_count || 0, items: "Events" }]}
        />
      </div>
    </div>
  );
}
