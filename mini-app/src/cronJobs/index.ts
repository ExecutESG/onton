import { CheckTransactions } from "@/cronJobs/tasks/CheckTransactions";
import { CreateEventOrders } from "@/cronJobs/tasks/CreateEventOrders";
import { UpdateEventCapacity } from "@/cronJobs/tasks/UpdateEventCapacity";
import { MintNFTForPaidOrders } from "@/cronJobs/tasks/MintNFTForPaidOrders";
import { TsCsbtTicketOrder } from "@/cronJobs/tasks/TsCsbtTicketOrder";
import { sendPaymentReminder } from "@/cronJobs/tasks/sendPaymentReminder";
import { OrganizerPromoteProcessing } from "@/cronJobs/tasks/OrganizerPromoteProcessing";
import { CreateRewards } from "@/cronJobs/tasks/CreateRewards";
import { notifyUsersForRewards } from "@/cronJobs/tasks/notifyUsersForRewards";
import { cronJobRunner } from "@/cronJobs/cornJobRunner";
import { syncSbtCollectionsForEvents } from "@/cronJobs/tasks/syncSbtCollectionsForEvents";
import { CheckAllUsersBlock } from "@/cronJobs/tasks/checkBlockStatus";
import { CheckSbtStatus } from "@/cronJobs/tasks/checkTSRewardStatus";
import { runPendingCallbackTasks } from "@/cronJobs/tasks/runAPIPendingCallbackTasks";
import { consumeClickBatch } from "@/cronJobs/tasks/consumeClickBatch";
import { generateInviteLinksCron } from "@/cronJobs/tasks/generateInviteLinksCron";
import { updateAllTournaments } from "@/cronJobs/tasks/updateTournaments";
import { processRecentlyEndedTournaments } from "@/cronJobs/tasks/tournamentRewards";
import { sendTournamentRewardsNotifications } from "@/cronJobs/tasks/sendTournamentRewardsNotifications";
import { processCampaignOrders } from "@/cronJobs/tasks/processCampaignOrders";
import { processCampaignAffiliateSpins } from "@/cronJobs/tasks/processCampaignAffiliateSpins";
import { updateAllUserWalletBalances } from "@/cronJobs/tasks/updateAllUserWalletBalances";
import { syncOngoingTournamentsLeaderboard } from "@/cronJobs/tasks/syncOngoingTournamentsLeaderboard";
import { checkAndEnrollUserInPlay2WinCampaign } from "@/cronJobs/tasks/checkAndEnrollUserInPlay2WinCampaign";
import { mintNftForUserSpins } from "@/cronJobs/tasks/mintNftsForUserSpins";
import { deployMissingCampaignCollections } from "@/cronJobs/tasks/deployMissingCampaignCollections";
import { checkMinterTransactions } from "@/cronJobs/tasks/checkNFTTransactions";
import { mintPlatinumNftForMergedNFTS } from "@/cronJobs/tasks/mintPlatinumNftForMergedNFTS";
import { burnMergedNfts } from "@/cronJobs/tasks/burnMergedNfts";
import { deployNFTApiCollections } from "@/cronJobs/tasks/deployNFTApiCollections";
import { mintNFTApiCollections } from "@/cronJobs/tasks/mintNFTApiCollections";
import { runCollectionSnapshot } from "@/cronJobs/tasks/runCollectionSnapshot";
import { syncPlay2WinScores } from "@/cronJobs/tasks/syncPlay2WinScores";
import { sendPendingPromoCodes } from "@/cronJobs/tasks/promoCron";
import { createWalletsForUpcomingEvents } from "@/cronJobs/tasks/createEventWallets";
import { distributeRafflesTon } from "@/cronJobs/tasks/distributeRaffleTon";
import { sendAllPendingPrizeNotifications } from "@/cronJobs/tasks/sendAllPendingPrizeNotifications";

const cronJobs = {
  CheckTransactions,
  CreateEventOrders,
  UpdateEventCapacity,
  MintNFTForPaidOrders,
  TsCsbtTicketOrder,
  sendPaymentReminder,
  OrganizerPromoteProcessing,
  CreateRewards,
  notifyUsersForRewards,
  syncSbtCollectionsForEvents,
  CheckAllUsersBlock,
  CheckSbtStatus,
  runPendingCallbackTasks,
  consumeClickBatch,
  generateInviteLinksCron,
  updateAllTournaments,
  processRecentlyEndedTournaments,
  sendTournamentRewardsNotifications,
  processCampaignOrders,
  processCampaignAffiliateSpins,
  updateAllUserWalletBalances,
  syncOngoingTournamentsLeaderboard,
  checkAndEnrollUserInPlay2WinCampaign,
  mintNftForUserSpins,
  deployMissingCampaignCollections,
  checkMinterTransactions,
  mintPlatinumNftForMergedNFTS,
  burnMergedNfts,
  deployNFTApiCollections,
  mintNFTApiCollections,
  runCollectionSnapshot,
  syncPlay2WinScores,
  sendPendingPromoCodes,
  createWalletsForUpcomingEvents,
  distributeRafflesTon,
  sendAllPendingPrizeNotifications,
};
export { cronJobRunner };
export default cronJobs;
