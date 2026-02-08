export type OrderType = "nft_mint" | "event_creation" | "event_capacity_increment";

export type PaymentToken = {
  token_id: number;
  symbol: string;
  decimals: number;
  master_address?: string | null;
  is_native?: boolean | null;
  logo_url?: string | null;
};
export type OrderState = "completed" | "new" | "confirming" | "processing" | "cancelled" | "failed";

export type GetOrderResponse = {
  total_price: string;
  nft_collection_address: string | null;
  tickets: {
    id: number;
    event_uuid: string | null;
    name: string | null;
    user_id: number | null;
    created_at: Date | null;
    updatedAt: Date | null;
    updatedBy: string;
    status: "USED" | "UNUSED" | null;
    ticket_id: number;
    telegram: string | null;
    company: string | null;
    position: string | null;
    order_uuid: string | null;
    nftAddress: string | null;
  }[];
  event_uuid: string | null;
  user_id: number | null;
  created_at: Date | null;
  updatedAt: Date | null;
  updatedBy: string;
  payment_type?: string;
  token?: PaymentToken;
  uuid: string;
  state: OrderState;
  order_type: OrderType;
  owner_address: string | null;
  utm_source: string | null;
};
