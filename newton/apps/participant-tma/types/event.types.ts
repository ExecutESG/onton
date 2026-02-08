import { PaymentToken } from "./order.types";

export interface OrganizerType {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  wallet_address: null | string;
  language_code: string;
  role: "organizer" | "admin" | "user";
  created_at: string;
  org_channel_name: string | null;
  org_image: string | null;
  hosted_event_count: number;
}

export interface EventCategoryType {
  category_id: number;
  name: string;
  description?: string;
  icon_url?: string;
  sort_order?: number;
  enabled: boolean;
}
export interface EventDataOnlyType {
  website?: {
    label: string;
    link: string;
  };
  organizer?: OrganizerType;
  eventTicket?: {
    created_at: Date | null;
    event_id: number;
    title: string;
    description: string;
    id: number;
    price: number;
    ticketImage: string;
    count: number;
    collectionAddress: string | null;
    payment_type?: string;
    token?: PaymentToken;
  };
  event_id: number;
  event_uuid: string;
  type: number;
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  wallet_address: string;
  wallet_seed_phrase: string;
  society_hub: string;
  society_hub_id: string;
  activity_id: number;
  sbt_collection_address: string;
  secret_phrase: string;
  start_date: number;
  end_date: number;
  timezone: string;
  location: string;
  owner: number;
  hidden: boolean;
  ticketToCheckIn: boolean;
  created_at: string;
  accessRoles: Array<{ user_id: number; role: string }> | undefined;
  hasActiveCoupon: boolean;
  category?: EventCategoryType;
}

export interface EventType extends EventDataOnlyType {
  organizer: OrganizerType;
  userTicket?: {
    status: "USED" | "UNUSED" | null;
    user_id: number | null;
    name: string | null;
    created_at: Date | null;
    event_uuid: string | null;
    id: number;
    telegram: string | null;
    company: string | null;
    position: string | null;
    nftAddress: string | null;
    ticket_id: number;
  };
  userHasTicket: boolean;
  needToUpdateTicket: boolean;
  chosenNFTaddress: string;
  orderAlreadyPlace: boolean;
  isSoldOut: boolean;
}

// New type definitions for a valid coupon response
export interface CouponItem {
  coupon_id: number;
  coupon_code: string;
  coupon_status: string; // Could be refined to a union type if needed
  coupon_definition_id: number;
}

export interface CouponDefinition {
  cpd_type: "fixed" | "percent";
  cpd_status: "active";
  value: number;
  discounted_price: number;
  start_date: number;
  end_date: number;
}

export interface CouponData {
  item: CouponItem;
  definition: CouponDefinition;
}
