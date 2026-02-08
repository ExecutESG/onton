import { getErrorMessages } from "@/lib/error";
import { CronJob } from "cron";
import "dotenv/config";
import { logger } from "@/server/utils/logger";
import "@/lib/gracefullyShutdown";
import cronJobs, { cronJobRunner } from "@/cronJobs";
import { redisTools } from "@/lib/redisTools";
import { is_prod_env, is_stage_env } from "@/server/utils/evnutils";
import { checkMinterTransactions } from "@/cronJobs/tasks/checkNFTTransactions";
import { mintPlatinumNftForMergedNFTS } from "@/cronJobs/tasks/mintPlatinumNftForMergedNFTS";
import { distributeRafflesTon } from "@/cronJobs/tasks/distributeRaffleTon";
import { sendAllPendingPrizeNotifications } from "@/cronJobs/tasks/sendAllPendingPrizeNotifications";

process.on("unhandledRejection", (err) => {
  const messages = getErrorMessages(err);
  logger.error("UNHANDLED ERROR", messages);
});

const deleteLockKeys = async () => {
  const functionNames = Object.keys(cronJobs).filter(
    (key) => typeof (cronJobs as Record<string, unknown>)[key] === "function"
  );

  for (const fn of functionNames) {
    logger.log("Deleting lock for", fn);
    await redisTools.deleteCache(redisTools.cacheKeys.cronJobLock + fn);
  }
};

async function MainCronJob() {
  logger.log("====> RUNNING Cron jobs on", process.env.ENV);
  // this method will delete all the lock keys on startup to avoid any stale locks
  await deleteLockKeys();

  new CronJob("0 */4 * * *", cronJobs.sendPaymentReminder, null, true);
  new CronJob("*/7 * * * * *", cronJobs.CheckTransactions, null, true);
  new CronJob("*/24 * * * * *", cronJobRunner(cronJobs.UpdateEventCapacity), null, true);
  new CronJob("*/19 * * * * *", cronJobRunner(cronJobs.CreateEventOrders), null, true);
  new CronJob("*/9 * * * * *", cronJobRunner(cronJobs.MintNFTForPaidOrders), null, true);
  new CronJob("*/11 * * * * *", cronJobRunner(cronJobs.TsCsbtTicketOrder), null, true);
  new CronJob("*/21 * * * * *", cronJobs.OrganizerPromoteProcessing, null, true);
  //runPendingCallbackTasks
  new CronJob(
    "*/60 * * * * *",
    cronJobs.runPendingCallbackTasks, // The function to run
    null, // onComplete (not needed)
    true, // start immediately
    null, // timeZone
    null, // context
    false, // runOnInit => false (don't run on app start)
    null, // utcOffset => null
    false, // unrefTimeout => false
    true // waitForCompletion => true
  );
  new CronJob(
    "0 0 0 * * *", // second 0, minute 0, hour 0 → every midnight UTC
    cronJobs.runCollectionSnapshot,
    null, // onComplete
    true, // start immediately
    "Europe/Helsinki", // <<— run in   Helsinki time
    null, // context
    false, // runOnInit
    null, // utcOffset (deprecated; keep null)
    false, // unrefTimeout
    true // waitForCompletion
  );
  new CronJob(
    "*/7 * * * * *", //  Every 7 seconds
    cronJobs.createWalletsForUpcomingEvents,
    null, // onComplete
    true, // start immediately
    "Europe/Helsinki", // <<— run in   Helsinki time
    null, // context
    false, // runOnInit
    null, // utcOffset (deprecated; keep null)
    false, // unrefTimeout
    true // waitForCompletion
  );
  new CronJob(
    "*/50 * * * * *", // second 0, minute 0, hour 0 → every midnight UTC
    cronJobs.distributeRafflesTon,
    null, // onComplete
    true, // start immediately
    "Europe/Helsinki", // <<— run in   Helsinki time
    null, // context
    false, // runOnInit
    null, // utcOffset (deprecated; keep null)
    false, // unrefTimeout
    true // waitForCompletion
  );

  new CronJob(
    "*/50 * * * * *", // second 0, minute 0, hour 0 → every midnight UTC
    cronJobs.sendAllPendingPrizeNotifications,
    null, // onComplete
    true, // start immediately
    "Europe/Helsinki", // <<— run in   Helsinki time
    null, // context
    false, // runOnInit
    null, // utcOffset (deprecated; keep null)
    false, // unrefTimeout
    true // waitForCompletion
  );

  // new CronJob(
  //   "*/2 * * * * *",
  //   cronJobs.processCampaignOrders, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
  // new CronJob(
  //   "*/3 * * * * *", // Every 3 seconds
  //   cronJobs.checkMinterTransactions, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
  // new CronJob(
  //   "*/55 * * * * *", // Every 55 seconds
  //   cronJobs.mintPlatinumNftForMergedNFTS, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
  // new CronJob(
  //   "*/3 * * * * *", // Every 3 seconds
  //   cronJobs.burnMergedNfts, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
  //
  // /** these cronjob are for minting and affiliate spins for campaigns */
  // new CronJob(
  //   "*/2 * * * * *", // Every  2 seconds
  //   cronJobs.processCampaignAffiliateSpins, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
  // new CronJob(
  //   "*/55 * * * * *", // every 55 seconds
  //   cronJobs.mintNftForUserSpins, // The function to run
  //   null, // onComplete (not needed)
  //   true, // start immediately
  //   null, // timeZone
  //   null, // context
  //   false, // runOnInit => false (don't run on app start)
  //   null, // utcOffset => null
  //   false, // unrefTimeout => false
  //   true // waitForCompletion => true
  // );
}

MainCronJob().then(() => logger.log("Cron Jobs Started"));
