import { events, rewards, RewardTonSocietyStatusType, visitors } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { TONSOcietyAPISchemaT } from "./ton-society-api-types";
import { RewardStatus } from "@/db/enum";

export type TonSocietyRegisterActivityT = {
  title: string;
  subtitle: string;
  additional_info?: string;
  description: string;
  hub_id: number;
  start_date: string;
  end_date: string;
  cta_button?: {
    label: string;
    link: string;
  };
  rewards?: TONSOcietyAPISchemaT["RewardsManualMint"];
};

export type TonSocietyRegisterActivityResponse = {
  status: "success" | "failed";
  data: {
    activity_id: number;
    activity_url: string;
  };
};

export interface TonSocietyActivityFullResponse {
  status: string; // typically "success" or "error"
  data: {
    title: string;
    subtitle: string;
    description: string;
    link: string;
    public_path: string;
    additional_info: string;
    start_date: string; // e.g. "2024-12-02"
    end_date: string; // e.g. "2024-12-09"
    publishedAt?: string;
    rewards?: {
      mint_type?: string;
      collection?: {
        cover?: {
          url: string;
        };
        image?: {
          url: string;
        };
        title?: string;
        description?: string;
        item_image?: {
          url: string;
        };
        item_title?: string;
        item_description?: string;
        item_metadata?: {
          activity_type?: string;
          place?: {
            type?: string;
            venue_name?: string;
          };
        };
        item_video?: {
          url: string;
        };
      };
      collection_address?: string; // might not exist in all cases
      hub?: {
        id: number;
      };
    };
    join_button?: {
      title?: string;
      link?: string;
    };
  };
}

/**
 * This type describes a single row returned by your query,
 * after you convert all BigInt / numeric fields to numbers or strings.
 */
export type EventWithScoreAndReward = {
  eventId: number;
  eventTitle: string;
  eventUuid: string;
  eventStartDate: number;
  eventEndDate: number;
  imageUrl: string | null;
  visitorId: number;
  tonSocietyStatus: RewardTonSocietyStatusType | null; // or a more specific enum if you have "NOT_CLAIMED" | "CLAIMED", etc.
  rewardId: string | null;
  rewardStatus: RewardStatus | null;
  rewardLink: string | null;
  userScoreId: number | null;
  userClaimedPoints: number;
  pointsCouldBeClaimed: number;
};

export type RewardType = InferSelectModel<typeof rewards>;
export type VisitorsType = InferSelectModel<typeof visitors>;
export type EventType = InferSelectModel<typeof events>;
export type EventTypeSecure = Omit<EventType, "wallet_address" | "wallet_seed_phrase" | "secret_phrase">;
