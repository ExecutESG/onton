import { ReactNode } from "react";

export interface TicketPassData {
  full_name: string;
  telegram: string;
  company: string | null;
  position: string | null;
  nftAddress: string | null;
  status: string;
  orderUuid: string | null;
  eventUuid: string;
  needsInfoUpdate: boolean;
  inviteLink: string | null;
  ticketData: {
    ticketImage: string;
    eventTitle: string;
    eventSubtitle: string | null;
    eventDescription: string;
    collectionAddress: string | null;
  };
  userSbtTicket?: {
    data: { reward_link?: string } | null;
  };
}

export type TicketAttributeRow = [string, ReactNode];
