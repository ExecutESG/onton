"use client";
import { Section } from "@ui/base/section";
import ButtonTma from "@ui/components/Button";
import PageTma from "@ui/components/Page";
import Image from "next/image";
import { FaMinus, FaPlus } from "react-icons/fa";

import QueryState from "@ui/components/blocks/QueryState";
import CheckoutCard from "~/components/event/buy-ticket/BuyTicketCard";
import BuyTicketForm from "~/components/event/buy-ticket/BuyTicketForm";
import { useEventData } from "~/hooks/queries/useEventData";

type BuyTicketProps = {
  params: {
    id: string;
  };
  searchParams: { [key: string]: string | undefined };
};

type TicketInfoProps = {
  ticket: {
    ticketImage: string;
    price: number | string;
    payment_type?: string;
    token?: {
      symbol: string;
    };
    title: string;
  };
};

const TicketInfo = ({ ticket }: TicketInfoProps) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Image
          priority
          alt={"ticket image"}
          width={64}
          height={64}
          className="h-16 w-16 rounded-sm border-[0.34px]"
          src={ticket.ticketImage}
        />
        <div className="flex flex-col">
          <h5 className="type-headline font-semibold">
            {ticket.price} {ticket.token?.symbol ?? ticket.payment_type}
          </h5>
          <p className="type-subtitle-2 text-telegram-hint-color font-normal">{ticket.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ButtonTma
          buttonColor={"gray"}
          disabled
          className="h-8 w-8 rounded-full"
        >
          <FaMinus
            fill="#8E8E93"
            className="h-4 w-4"
            width={32}
            height={32}
          />
        </ButtonTma>
        <span className="text-[17px] font-semibold">1</span>
        <ButtonTma
          buttonColor={"gray"}
          disabled
          className="h-8 w-8 rounded-full"
        >
          <FaPlus
            fill="#8E8E93"
            className="h-4 w-4"
            width={32}
            height={32}
          />
        </ButtonTma>
      </div>
    </div>
  );
};

const BuyTicket = ({ params, searchParams }: BuyTicketProps) => {
  const { data: event, isError, isLoading } = useEventData(params.id);

  const affiliate_id = searchParams.affiliate || null;

  if (isLoading) {
    return <QueryState />;
  }

  if (isError || !event) {
    return <QueryState isError={isError} />;
  }

  if (event.hidden) {
    return <QueryState description={"Event is not published yet"} />;
  }

  if (!event.eventTicket || !event.ticketToCheckIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#EFEFF4] text-center">
        <h1>This event does not require ticket to Check-In</h1>
      </div>
    );
  }

  const paymentToken = event.eventTicket.token ??
    (event.eventTicket.payment_type
      ? {
          token_id: -1,
          symbol: event.eventTicket.payment_type,
          decimals: event.eventTicket.payment_type.toUpperCase() === "USDT" ? 6 : 9,
          is_native: event.eventTicket.payment_type.toUpperCase() === "TON",
          master_address: null,
          logo_url: null,
        }
      : null);

  return (
    <PageTma className={"bg-telegram-secondary-bg-color flex flex-col gap-6 pt-0"}>
      <Section
        className="grid gap-4 pt-7"
        variant={"plain"}
      >
        <CheckoutCard
          eventImage={event.eventTicket.ticketImage}
          eventName={event.eventTicket.title}
          initialPrice={event.eventTicket.price}
          currency={paymentToken?.symbol ?? ""}
          has_discount={event.hasActiveCoupon}
          eventId={event.event_id}
        />
      </Section>
      <BuyTicketForm
        isSoldOut={event.isSoldOut}
        userHasTicket={!!event.userTicket}
        orderAlreadyPlace={event.orderAlreadyPlace}
        id={params.id}
        sendTo={event.wallet_address}
        event_uuid={event.event_uuid}
        price={event.eventTicket.price}
        affiliate_id={affiliate_id}
        paymentToken={paymentToken}
      />
    </PageTma>
  );
};

export default BuyTicket;
