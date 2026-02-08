interface VisitorBase {
  user_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  wallet_address: string | null;
  created_at: Date | null;
  badge_info: string | null;
  dynamicFields: { event_field_id: number; data: string | null }[];
}

interface VisitorWithTicket extends VisitorBase {
  has_ticket: boolean;
  ticket_status: string;
  ticket_id: number;
  badge_info: string | null;
}

export type VisitorsWithDynamicFields = VisitorWithTicket | VisitorBase;
