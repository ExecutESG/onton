import { ReactNode } from "react";

export type RewardDataTyepe = {
  reward_link?: string;
};

export type TicketType = {
  id: number;
  full_name: string;
  telegram: string;
  company: string;
  position: string;
  status: string;
  telegram_invite_link?: string | null;
  nftAddress: string | null;
  event_uuid: string;
  ticket_id: number;
  user_id: number;
  order_uuid: string;
  created_at: string;
  ticketData: {
    id: number;
    event_uuid: string | null;
    title: string;
    description: string;
    price: number;
    ticketImage: string;
    count: number;
    collectionAddress: string | null;
    created_at: string;
  };
  userSbtTicket?: {
    id: string;
    data: RewardDataTyepe | null;
    type: "ton_society_sbt" | "ton_society_csbt_ticket" | null;
    created_at: Date | null;
    updatedAt: Date | null;
    updatedBy: string;
    status:
      | "failed"
      | "pending_creation"
      | "created"
      | "created_by_ui"
      | "received"
      | "notified"
      | "notified_by_ui"
      | "notification_failed"
      | "fixed_failed";
    visitor_id: number;
    tryCount: number;
    event_start_date: number;
    event_end_date: number;
    tonSocietyStatus: "NOT_CLAIMED" | "CLAIMED" | "RECEIVED" | "NOT_ELIGIBLE";
  };
  needsInfoUpdate: boolean;
};

export type TicketAttributes = [string, ReactNode][];
