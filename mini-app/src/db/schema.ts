import {
  developmentEnvironment,
  eventParticipationType,
  eventPoaResultStatus,
  EventPoaResultStatus,
  EventTriggerStatus,
  eventTriggerStatus,
  EventTriggerType,
  eventTriggerType,
  notificationItemType,
  NotificationItemType,
  notificationStatus,
  NotificationStatus,
  notificationType,
  NotificationType,
  orderState,
  paymentTypes,
  rewardStatus,
  rewardType,
  ticketStatus,
  CampaignType,
  campaignTypes,
  nftStatusEnum,
  NftStatusEnum,
  claimStatusEnum,
  walletTypeEnum,
} from "@/db/enum";

import { specialGuests } from "@/db/schema/specialGuest";
import { airdropRoutineRelations, airdropRoutines } from "./schema/airdropRoutines";
import { coupon_definition, coupon_definition_status, coupon_definition_type } from "./schema/coupon_definition";
import { coupon_item_status, coupon_items, couponMessageSendStatus, CouponMessageSendStatus } from "./schema/coupon_items";
import { event_details_search_list } from "./schema/event_details_search_list";
import { eventFieldRelations, eventFields } from "./schema/eventFields";
import { eventPayment, EventTicketType, organizerPaymentStatus, pgTicketTypes, ticketTypes } from "./schema/eventPayment";
import { eventPoaResults, eventPoaResultsIndexes } from "./schema/eventPoaResults";
import { eventPoaTriggers, eventPoaTriggersIndexes } from "./schema/eventPoaTriggers";
import { eventRegistrants, eventRegistrantStatus } from "./schema/eventRegistrants";
import { events, raffleKindEnum, RaffleKindType } from "./schema/events";
import { eventTokens } from "./schema/eventTokens";
import { giataCity } from "./schema/giataCity";
import { moderationLog, ModerationLogActionType } from "./schema/moderation_log";
import { nftItems } from "./schema/nft_items";
import { notifications } from "./schema/notifications";
import { ontoSetting } from "./schema/ontoSetting";
import { orders, orderTypes } from "./schema/orders";
import { rewards, RewardsSelectType, RewardTonSocietyStatusType } from "./schema/rewards";
import { sbtRewardCollections } from "./schema/sbtRewardCollections";
import { sideEvents } from "./schema/sideEvents";
import { tickets, ticketsRelations } from "./schema/tickets";
import { user_custom_flags, user_flags, userFlagsType } from "./schema/user_custom_flags";
import { userEventFieldRelations, userEventFields } from "./schema/userEventFields";
import { userRelations, users } from "./schema/users";
import { visitors } from "./schema/visitors";
import { walletChecks } from "./schema/walletChecks";
import { affiliateLinks, AffiliateLinksRow, AffiliateItemTypeEnum, affiliateItemType } from "./schema/affiliateLinks";
import { affiliateClick, AffiliateClickRow } from "./schema/affiliateClick";
import { tasks, TasksInsert, TaskPeriodType, taskPeriodEnum, taskTypeEnum, TaskTypeType, Tasks } from "./schema/tasks";
import {
  tournaments,
  TournamentsRow,
  TournamentsRowInsert,
  tournamentStateType,
  tournamentEntryType,
  tournamentPrizePoolStatusType,
  tournamentPrizeType,
} from "./schema/tournaments";
import { games, GamesRowInsert } from "./schema/games";
import {
  accessRoleEnum,
  accessRoleEnumType,
  accessRoleItemType,
  accessRoleItemTypeEnum,
  userRoles,
  userRolesRelations,
  userRoleStatusEnum,
} from "./schema/userRoles";
import {
  UserScoreItemType,
  usersScore,
  UsersScoreActivityType,
  usersScoreActivity,
  UsersScoreType,
  userScoreItem,
} from "./schema/usersScore";

import { callbackTaskRuns, CallbackTaskRunsRow, callbackTaskRunStatusType } from "./schema/callbackTaskRuns";
import { gameLeaderboard, GameLeaderboardRow, GameLeaderboardRowInsert } from "./schema/gameLeaderboard";
import {
  CallBackTaskAPINameType,
  CallBackTaskFunctionType,
  CallBackTaskItemType,
  callbackTasks,
  CallBackTaskSHttpMethodType,
  CallbackTasksRow,
  CallBackTaskStepNameType,
} from "./schema/callbackTasks";

import {
  tokenCampaignUserSpins,
  TokenCampaignUserSpins,
  TokenCampaignUserSpinsInsert,
  tokenCampaignSpinType,
  TokenCampaignSpinType,
} from "./schema/tokenCampaignUserSpins";
import {
  tokenCampaignSpinPackages,
  TokenCampaignSpinPackages,
  TokenCampaignSpinPackagesInsert,
} from "./schema/tokenCampaignSpinPackages";
import {
  tokenCampaignUserCollections,
  TokenCampaignUserCollections,
  TokenCampaignUserCollectionsInsert,
} from "./schema/tokenCampaignUserCollections";
import {
  tokenCampaignOrders,
  TokenCampaignOrders,
  TokenCampaignOrdersInsert,
  TokenCampaignOrdersStatus,
} from "./schema/tokenCampaignOrders";
import {
  tokenCampaignNftCollections,
  TokenCampaignNftCollections,
  TokenCampaignNftCollectionsInsert,
  TokenCampaignNftCollectionsPublic,
} from "./schema/tokenCampaignNftCollections";
import { tokenCampaignEligibleUsers, TokenCampaignEligibleUsers } from "./schema/tokenCampaignEligibleUsers";

import {
  userWalletBalances,
  placeOfWalletConnection,
  UserWalletBalances,
  UserWalletBalancesInsert,
  PlaceOfWalletConnection,
} from "./schema/userWalletBalances";
import {
  play2winCampaigns,
  Play2WinCampaignsInsert,
  Play2WinCampaignsRow,
  Play2WinCampaignType,
  play2winCampaignType,
} from "./schema/play2winCampaigns";
import {
  tokenCampaignNftItems,
  TokenCampaignNftItems,
  TokenCampaignNftItemsInsert,
  MergeStatusType,
  mergeStatusEnum,
} from "./schema/tokenCampaignNftItems";
import {
  tokenCampaignMergeTransactions,
  tokenCampaignMergeTransactionsStatus,
  TokenCampaignMergeTransactionsStatus,
  TokenCampaignMergeTransactions,
  TokenCampaignMergeTransactionsInsert,
} from "./schema/tokenCampaignMergeTransactions";

import { taskSBT, TaskSBT, TaskSBTInsert } from "@/db/schema/taskSbt";
import { taskGroups, TaskGroups, TaskGroupsInsert } from "@/db/schema/taskGroups";
import {
  taskUsers,
  taskSBTStatusEnum,
  taskUserPointStatusEnum,
  taskUserStatusEnum,
  TaskUsers,
  TaskUsersInsert,
  TaskUsersStatusType,
  TaskSbtStatusType,
  TaskUsersPointStatusType,
} from "@/db/schema/taskUsers";

import { nftApiKeys, NftApiKeys, NftApiKeysInsert } from "./schema/nftApiKeys";
import { nftApiMinterWallets, NftApiMinterWallets, NftApiMinterWalletsInsert } from "./schema/nftApiMinterWallets";
import {
  nftApiCollections,
  NftApiCollections,
  NftApiCollectionsInsert,
  NftApiCollectionsUpdate,
} from "./schema/nftApiCollections";
import { nftApiItems, NftApiItems, NftApiItemsInsert } from "./schema/nftApiItems";
import { userScoreRules, scoreRuleRole, UserScoreRuleRow, UserScoreRuleRoleType } from "./schema/userScoreRules";
import { eventCategories, EventCategoryRow } from "./schema/eventCategories";
import { snapshotCollections, SnapshotCollectionRow, SnapshotCollectionInsert } from "./schema/snapshotCollections";
import { userScoreSnapshots, UserScoreSnapshotRow, UserScoreSnapshotInsert } from "./schema/userScoreSnapshots";
import {
  tokenCampaignClaimOnion,
  TokenCampaignClaimOnionRow,
  TokenCampaignClaimOnionInsert,
} from "./schema/tokenCampaignClaimOnion";

import { eventWallets, EventWalletRow } from "./schema/eventWallets";
import { eventRaffles, raffleStatus, EventRaffleInsert, EventRaffleRow, RaffleStatusType } from "./schema/eventRaffles";
import { raffleTokens, RaffleTokenRow } from "./schema/raffleTokens";
import {
  eventRaffleResults,
  EventRaffleResultRow,
  EventRaffleResultInsert,
  eventRaffleResultStatus,
  eventRaffleResultStatusType,
} from "./schema/eventRaffleResults";
import { eventMerchRaffles } from "./schema/eventMerchRaffles";
import {
  eventMerchRaffleResults,
  merchResultStatus,
  MerchResultStatusType,
  EventMerchRaffleResultRow,
} from "./schema/eventMerchRaffleResults";
import {
  eventMerchPrizes,
  eventMerchFulfilMethod,
  eventMerchPrizeStatus,
  EventMerchFulfilMethodType,
  EventMerchPrizeRow,
  EventMerchPrizeInsert,
  EventMerchPrizeStatusType,
} from "./schema/eventMerchPrizes";

import {
  eventMerchPrizeResults,
  eventMerchPrizeResultStatus,
  EventMerchPrizeResultStatusType,
  EventMerchPrizeResultInsert,
  EventMerchPrizeResultRow,
  eventMerchNotifStatus,
  EventMerchNotifStatusType,
} from "./schema/eventMerchPrizeResults";

import {
  partnershipAffiliatePurchases,
  PartnershipAffiliatePurchasesRow,
  PartnershipAffiliateUserEntryEnum,
  PartnershipAffiliateUserEntryType,
} from "./schema/partnershipAffiliatePurchases";
import { usersX } from "./schema/usersX";
import { usersGithub } from "./schema/usersGithub";
import { usersLinkedin } from "./schema/usersLinkedin";
import { usersGoogle } from "./schema/usersGoogle";
import { usersOutlook } from "./schema/usersOutlook";

export {
  accessRoleEnum,
  accessRoleItemTypeEnum,
  coupon_definition_status,
  coupon_definition_type,
  coupon_item_status,
  developmentEnvironment,
  eventParticipationType,
  eventPoaResultStatus,
  eventTriggerStatus,
  eventTriggerType,
  notificationItemType,
  notificationStatus,
  notificationType,
  orderState,
  orderTypes,
  paymentTypes,
  pgTicketTypes,
  rewardStatus,
  rewardType,
  ticketStatus,
  ticketTypes,
  user_flags,
  userRoleStatusEnum,
  affiliateItemType,
  campaignTypes,
  tokenCampaignMergeTransactionsStatus,
  tasks,
  taskPeriodEnum,
  taskTypeEnum,
  taskSBT,
  taskGroups,
  taskUsers,
  taskSBTStatusEnum,
  taskUserPointStatusEnum,
  taskUserStatusEnum,
  userScoreItem,
  snapshotCollections,
  claimStatusEnum,
  walletTypeEnum,
  eventWallets,
  eventRaffles,
  raffleTokens,
  raffleStatus,
  eventRaffleResults,
  eventRaffleResultStatus,
  eventMerchRaffles,
  eventMerchRaffleResults,
  merchResultStatus,
  eventMerchFulfilMethod,
  eventMerchPrizeStatus,
  eventMerchPrizes,
  eventMerchPrizeResults,
  eventMerchPrizeResultStatus,
  raffleKindEnum,
  eventMerchNotifStatus,
  eventTokens,
};

// export all the tables and relations
export {
  airdropRoutineRelations,
  airdropRoutines,
  callbackTaskRuns,
  callbackTasks,
  coupon_definition,
  coupon_items,
  event_details_search_list,
  eventFieldRelations,
  eventFields,
  eventPayment,
  eventPoaResults,
  eventPoaResultsIndexes,
  eventPoaTriggers,
  eventPoaTriggersIndexes,
  eventRegistrants,
  eventRegistrantStatus,
  events,
  eventCategories,
  giataCity,
  moderationLog,
  nftItems,
  notifications,
  ontoSetting,
  orders,
  organizerPaymentStatus,
  rewards,
  sbtRewardCollections,
  sideEvents,
  specialGuests,
  tickets,
  ticketsRelations,
  user_custom_flags,
  userEventFieldRelations,
  userEventFields,
  userRelations,
  userRoles,
  userRolesRelations,
  users,
  usersScore,
  visitors,
  walletChecks,
  affiliateLinks,
  affiliateClick,
  tournaments,
  games,
  gameLeaderboard,
  tokenCampaignUserSpins,
  tokenCampaignSpinType,
  tokenCampaignSpinPackages,
  tokenCampaignUserCollections,
  tokenCampaignOrders,
  tokenCampaignNftCollections,
  tokenCampaignEligibleUsers,
  userWalletBalances,
  placeOfWalletConnection,
  play2winCampaigns,
  play2winCampaignType,
  tokenCampaignNftItems,
  mergeStatusEnum,
  tokenCampaignMergeTransactions,
  nftApiKeys,
  nftApiMinterWallets,
  nftApiCollections,
  nftApiItems,
  nftStatusEnum,
  userScoreRules,
  scoreRuleRole,
  usersScoreActivity,
  userScoreSnapshots,
  tokenCampaignClaimOnion,
  couponMessageSendStatus,
  partnershipAffiliatePurchases,
  PartnershipAffiliateUserEntryEnum,
  usersX,
  usersGithub,
  usersLinkedin,
  usersGoogle,
  usersOutlook,
};

// Type Exports
export type {
  accessRoleEnumType,
  accessRoleItemType,
  EventPoaResultStatus,
  EventTriggerStatus,
  EventTriggerType,
  EventCategoryRow,
  ModerationLogActionType,
  NotificationItemType,
  NotificationStatus,
  NotificationType,
  RewardTonSocietyStatusType,
  RewardsSelectType as RewardType,
  userFlagsType,
  UserScoreItemType,
  UsersScoreActivityType,
  UsersScoreType,
};

export type {
  CallBackTaskAPINameType,
  CallBackTaskFunctionType,
  CallBackTaskItemType,
  CallbackTaskRunsRow,
  callbackTaskRunStatusType,
  CallBackTaskSHttpMethodType,
  CallbackTasksRow,
  TournamentsRowInsert,
  CallBackTaskStepNameType,
  EventTicketType,
  AffiliateLinksRow,
  AffiliateItemTypeEnum,
  AffiliateClickRow,
  TournamentsRow,
  tournamentStateType,
  tournamentEntryType,
  tournamentPrizePoolStatusType,
  tournamentPrizeType,
  GamesRowInsert,
  GameLeaderboardRow,
  GameLeaderboardRowInsert,
  TokenCampaignUserSpins,
  TokenCampaignUserSpinsInsert,
  TokenCampaignSpinPackages,
  TokenCampaignSpinPackagesInsert,
  TokenCampaignUserCollections,
  TokenCampaignUserCollectionsInsert,
  TokenCampaignSpinType,
  TokenCampaignOrders,
  TokenCampaignOrdersInsert,
  TokenCampaignOrdersStatus,
  TokenCampaignNftCollections,
  TokenCampaignNftCollectionsPublic,
  TokenCampaignNftCollectionsInsert,
  CampaignType,
  TokenCampaignEligibleUsers,
  UserWalletBalances,
  UserWalletBalancesInsert,
  PlaceOfWalletConnection,
  Play2WinCampaignsInsert,
  Play2WinCampaignsRow,
  Play2WinCampaignType,
  TokenCampaignNftItems,
  TokenCampaignNftItemsInsert,
  MergeStatusType,
  TokenCampaignMergeTransactions,
  TokenCampaignMergeTransactionsInsert,
  TokenCampaignMergeTransactionsStatus,
  TasksInsert,
  TaskPeriodType,
  TaskTypeType,
  Tasks,
  TaskSBTInsert,
  TaskSBT,
  TaskGroups,
  TaskGroupsInsert,
  TaskUsers,
  TaskUsersInsert,
  TaskUsersStatusType,
  TaskSbtStatusType,
  TaskUsersPointStatusType,
  // NFT API keys
  NftApiKeys,
  NftApiKeysInsert,
  // Minter wallets
  NftApiMinterWallets,
  NftApiMinterWalletsInsert,
  // Collections
  NftApiCollections,
  NftApiCollectionsInsert,
  // Items
  NftApiItems,
  NftApiItemsInsert,
  NftStatusEnum,
  NftApiCollectionsUpdate,
  UserScoreRuleRow,
  UserScoreRuleRoleType,
  SnapshotCollectionRow,
  SnapshotCollectionInsert,
  UserScoreSnapshotRow,
  UserScoreSnapshotInsert,
  TokenCampaignClaimOnionRow,
  TokenCampaignClaimOnionInsert,
  CouponMessageSendStatus,
  EventWalletRow,
  RaffleTokenRow,
  EventRaffleRow,
  EventRaffleInsert,
  EventRaffleResultRow,
  EventRaffleResultInsert,
  eventRaffleResultStatusType,
  RaffleStatusType,
  EventMerchRaffleResultRow,
  MerchResultStatusType,
  EventMerchPrizeRow,
  EventMerchPrizeInsert,
  EventMerchFulfilMethodType,
  EventMerchPrizeStatusType,
  EventMerchPrizeResultRow,
  EventMerchPrizeResultInsert,
  EventMerchPrizeResultStatusType,
  RaffleKindType,
  EventMerchNotifStatusType,
  PartnershipAffiliatePurchasesRow,
  PartnershipAffiliateUserEntryType,

};
