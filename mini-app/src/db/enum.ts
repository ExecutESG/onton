import { pgEnum } from "drizzle-orm/pg-core";

export const eventParticipationType = pgEnum("event_participation_type", ["in_person", "online"]);
export const rewardType = pgEnum("reward_types", ["ton_society_sbt", "ton_society_csbt_ticket"]);
export const rewardStatus = pgEnum("reward_status", [
  "pending_creation",
  "created",
  "created_by_ui",
  "received",
  "notified",
  "notified_by_ui",
  "notification_failed",
  "failed",
  "fixed_failed",
]);
export const ticketStatus = pgEnum("event_ticket_status", ["USED", "UNUSED"]);
export const nftStatusEnum = pgEnum("nft_status_enum", ["CREATING", "MINTING", "VALIDATION_FAILED", "COMPLETED", "FAILED"]);

export const orderState = pgEnum("order_state", ["new", "confirming", "processing", "completed", "cancelled", "failed"]);
export const paymentTypes = pgEnum("payment_types", ["USDT", "TON", "STAR"]);
export const developmentEnvironment = pgEnum("development_environment", ["local", "development", "staging", "production"]);
export const eventTriggerType = pgEnum("event_trigger_type", ["simple", "multiple_choice", "question", "password"]);
export const eventTriggerStatus = pgEnum("event_trigger_status", ["active", "deactive", "completed", "sending"]);
export const notificationType = pgEnum("notification_type", [
  "POA_SIMPLE",
  "POA_PASSWORD",
  "POA_CREATION_FOR_ORGANIZER",
  "USER_RECEIVED_POA",
  "USER_ANSWER_POA",
  "MESSAGE_SIMPLE",
  "UNKNOWN",
]);
export const notificationStatus = pgEnum("notification_status", [
  "WAITING_TO_SEND",
  "DELIVERED",
  "READ",
  "REPLIED",
  "EXPIRED",
]);
export const notificationItemType = pgEnum("notification_item_type", [
  "POA_TRIGGER",
  "EVENT",
  "SBT_REWARD",
  "TRANSACTION",
  "UNKNOWN",
]);
export const eventPoaResultStatus = pgEnum("event_poa_result_status", ["REPLIED", "EXPIRED"]);
export const campaignTypes = pgEnum("campaign_type", ["onion1", "genesis_season", "merge_platinum"]);
export type CampaignType = (typeof campaignTypes.enumValues)[number];
// Type Exports
export type EventParticipationType = (typeof eventParticipationType.enumValues)[number];
export type RewardType = (typeof rewardType.enumValues)[number];
export type RewardStatus = (typeof rewardStatus.enumValues)[number];
export type TicketStatus = (typeof ticketStatus.enumValues)[number];
export type OrderState = (typeof orderState.enumValues)[number];
export type DevelopmentEnvironment = (typeof developmentEnvironment.enumValues)[number];

export type EventTriggerType = (typeof eventTriggerType.enumValues)[number];
export type EventTriggerStatus = (typeof eventTriggerStatus.enumValues)[number];
export type NotificationType = (typeof notificationType.enumValues)[number];
export type NotificationStatus = (typeof notificationStatus.enumValues)[number];
export type NotificationItemType = (typeof notificationItemType.enumValues)[number];
export type EventPoaResultStatus = (typeof eventPoaResultStatus.enumValues)[number];
export type PaymentTypes = (typeof paymentTypes.enumValues)[number];
export type NftStatusEnum = (typeof nftStatusEnum.enumValues)[number];

/** row state inside snapshots & claim table */
export const claimStatusEnum = pgEnum("claim_status", ["not_claimed", "claimed"]);
export type ClaimStatusEnum = (typeof claimStatusEnum.enumValues)[number];

/** how this wallet will receive ONION */
export const walletTypeEnum = pgEnum("wallet_type", ["primary", "secondary"]);
export type WalletTypeEnum = (typeof walletTypeEnum.enumValues)[number];
