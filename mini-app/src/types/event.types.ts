import { events, rewards, RewardTonSocietyStatusType, visitors } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { RewardStatus } from "@/db/enum";

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
