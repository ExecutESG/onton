import Image from "next/image";
import Link from "next/link";
import { Address } from "@ton/ton";
import { ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedUser } from "@/server/auth";
import { fetchTicketPassByEventUuid } from "@/db/modules/ticket.db";
import { contractAddressShortener } from "@/lib/contractAddressShortener";
import TicketTmaSettings from "./_components/TicketTmaSettings";
import { TicketShareButton } from "./_components/TicketShareButton";
import { TicketGroupInviteButton } from "./_components/TicketGroupInviteButton";
import { ClaimSbtButton } from "./_components/ClaimSbtButton";
import TicketUserAvatar from "./_components/TicketUserAvatar";
import type { TicketAttributeRow } from "@/types/ticketPass";

type Props = { params: { id: string } };

export default async function TicketPassPage({ params }: Props) {
  const [userId, unauthorized] = getAuthenticatedUser();

  if (unauthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f0f0] px-4 text-center">
        <p className="text-lg font-semibold text-gray-800">Authentication Required</p>
        <p className="mt-2 text-sm text-gray-500">Please open this page through the Telegram bot.</p>
      </div>
    );
  }

  const ticket = await fetchTicketPassByEventUuid(params.id, userId);

  if (!ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f0f0] px-4 text-center">
        <p className="text-lg font-semibold text-gray-800">Ticket Not Found</p>
        <p className="mt-2 text-sm text-gray-500">
          We couldn&apos;t find a ticket for this event. It may have been cancelled or the link is invalid.
        </p>
      </div>
    );
  }

  const attributes: TicketAttributeRow[] = [];

  if (ticket.full_name) {
    attributes.push([
      "Owner",
      <div key="owner" className="inline-flex items-center gap-2">
        <TicketUserAvatar />
        <span>
          {ticket.telegram.startsWith("@") ? ticket.telegram : `@${ticket.telegram}`}
        </span>
      </div>,
    ]);
  }

  if (ticket.nftAddress && ticket.ticketData.collectionAddress) {
    const ticketAddress = Address.parse(ticket.nftAddress).toString();
    const collectionAddress = Address.parse(ticket.ticketData.collectionAddress).toString();

    attributes.push([
      "Contract address",
      <Link
        key="contract"
        href={`https://${process.env.NODE_ENV === "development" ? "testnet." : ""}getgems.io/collection/${collectionAddress}/${ticketAddress}`}
        target="_blank"
        className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {contractAddressShortener(ticketAddress)}
      </Link>,
    ]);
  }

  attributes.push([
    "Status",
    <Badge
      key="status"
      variant={ticket.status === "checkedin" ? "default" : "secondary"}
      className={
        ticket.status === "checkedin"
          ? "bg-green-100 text-green-800 hover:bg-green-100"
          : "bg-blue-100 text-blue-800 hover:bg-blue-100"
      }
    >
      {ticket.status === "checkedin" ? "Checked In ✅" : "Active Pass 🎟️"}
    </Badge>,
  ]);

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      <div className="bg-white pb-4">
        <div className="mx-auto max-w-md px-4 pt-4">
          {ticket.ticketData.ticketImage ? (
            <Image
              priority
              width={358}
              height={358}
              src={ticket.ticketData.ticketImage}
              alt={`ticket-${params.id}`}
              className="w-full rounded-xl border border-gray-100 object-contain shadow-sm"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-4xl">
              🎟️
            </div>
          )}
        </div>
        <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
          {attributes.map(([label, value], index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="shrink-0 text-sm text-gray-500">{label}</span>
              <span className="text-right text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="bg-white px-4 py-4">
        <div className="mx-auto max-w-md">
          <h3 className="text-sm font-semibold text-gray-900">Event Details</h3>
          <p className="mt-2 text-sm text-gray-600">{ticket.ticketData.eventTitle}</p>
          {ticket.ticketData.eventSubtitle && (
            <p className="mt-1 text-sm text-gray-500">{ticket.ticketData.eventSubtitle}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">{ticket.ticketData.eventDescription}</p>
        </div>
      </div>

      <Separator />

      <div className="bg-white px-4 py-4">
        <div className="mx-auto max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Actions</h3>
          <div className="space-y-2">
            <TicketShareButton eventUuid={ticket.eventUuid} eventTitle={ticket.ticketData.eventTitle} />
            <TicketGroupInviteButton inviteLink={ticket.inviteLink} />
            {ticket.userSbtTicket?.data?.reward_link && (
              <ClaimSbtButton rewardLink={ticket.userSbtTicket.data.reward_link} />
            )}
          </div>
        </div>
      </div>

      <TicketTmaSettings ticketId={params.id} orderUuid={ticket.orderUuid ?? ""} eventId={ticket.eventUuid} />
    </div>
  );
}

export const dynamic = "force-dynamic";
