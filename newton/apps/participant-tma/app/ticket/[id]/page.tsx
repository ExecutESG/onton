import { Address } from "@ton/ton";
import { Page } from "@ui/base/page";
import { Section } from "@ui/base/section";
import QueryState from "@ui/components/blocks/QueryState";
import SectionCoverImage from "@ui/components/blocks/SectionCoverImage";
import SeparatorTma from "@ui/components/Separator";
import Image from "next/image";
import Link from "next/link";
import { FiExternalLink } from "react-icons/fi";

import { redirect } from "next/navigation";
import { ClaimTicketButton } from "~/components/ticket/ClaimTicketButton";
import { EventGroupInviteButton } from "~/components/ticket/EventGroupInviteButton";
import { ShareTicketButton } from "~/components/ticket/ShareTicketButton";
import SectionContent from "~/components/ticket/SectionContent";
import TicketAttributes from "~/components/ticket/TicketAttributes";
import TicketTmaSettings from "~/components/ticket/TicketTmaSettings";
import UserAvatar from "~/components/ticket/UserAvatar";
import { getTicketByEventUuid } from "~/services/ticket.services.ssr";
import { TicketAttributes as TicketAttributesType } from "~/types/ticket.types";
import { contractAddressShortner } from "~/utils/contractAddressShortner";
import { getAuthenticatedUser } from "~/utils/getAuthenticatedUser";

type TicketParams = {
  params: {
    id: string;
  };
};

const Ticket = async ({ params }: TicketParams) => {
  const [, error] = getAuthenticatedUser();

  if (error) {
    return (
      <QueryState
        text={(await error.json()).error}
        isError
      />
    );
  }

  const ticket = await getTicketByEventUuid(params.id);

  if (ticket === null) return "ticket not found";
  if (ticket.needsInfoUpdate) redirect(`/ticket/${params.id}/claim`);

  const attributes: TicketAttributesType = [];

  if (ticket.full_name !== undefined)
    attributes.push([
      "Owner",
      <div className={"inline-flex gap-2"}>
        <UserAvatar />
        <span>{ticket.telegram.startsWith("@") ? ticket.telegram : `@${ticket.telegram}`}</span>
      </div>,
    ]);
  if (ticket.nftAddress && ticket.ticketData.collectionAddress) {
    const ticketAddress = Address.parse(ticket.nftAddress).toString();
    const collectionAddress = Address.parse(ticket.ticketData.collectionAddress).toString();

    attributes.push([
      "Contract address",
      <Link
        href={`https://${process.env.NODE_ENV === "development" ? "testnet." : ""}getgems.io/collection/${collectionAddress}/${ticketAddress}`}
        target="_blank"
        className="text-accent-foreground inline-flex  items-center gap-2"
      >
        <FiExternalLink />
        {contractAddressShortner(ticketAddress)}
      </Link>,
    ]);
  }

  attributes.push([
    "Status",
    <span
      key="status"
      className={`font-semibold ${
        ticket.status === "checkedin"
          ? "text-green-600"
          : ticket.status === "approved"
            ? "text-blue-600"
            : "text-neutral-600"
      }`}
    >
      {ticket.status === "checkedin" ? "Checked In ✅" : "Active Pass 🎟️"}
    </span>,
  ]);

  return (
    <Page variant="withSections">
      <Section variant={"bottomRounded"}>
        <SectionCoverImage>
          <Image
            priority
            width={358}
            height={358}
            src={ticket.ticketData.ticketImage}
            alt={`ticket-${params.id}`}
            className="border-wallet-separator-color w-full rounded-lg border-[0.33px] object-contain"
          />
        </SectionCoverImage>
        <SectionContent
          title={`Ticket #${ticket.id}`}
          description={ticket.ticketData.description}
        />
        <SeparatorTma />
        <TicketAttributes data={attributes} />
        {ticket.telegram_invite_link && (
          <EventGroupInviteButton inviteLink={ticket.telegram_invite_link} />
        )}
        <ShareTicketButton
          eventUuid={ticket.event_uuid}
          eventTitle={ticket.ticketData?.title}
        />
        {ticket.userSbtTicket?.data?.reward_link && (
          <div className="mt-2 w-full">
            <ClaimTicketButton link={ticket.userSbtTicket.data.reward_link} />
          </div>
        )}
      </Section>
      <TicketTmaSettings
        ticketId={params.id}
        orderUuid={ticket.order_uuid}
        eventId={ticket.event_uuid}
      />
    </Page>
  );
};

export default Ticket;
export const dynamic = "force-dynamic";
