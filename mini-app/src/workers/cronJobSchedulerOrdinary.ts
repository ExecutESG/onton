import { getErrorMessages } from "@/lib/error";
import { CronJob } from "cron";
import "dotenv/config";
import { logger } from "@/server/utils/logger";
import "@/lib/gracefullyShutdown";
import cronJobs, { cronJobRunner } from "@/cronJobs";
import { redisTools } from "@/lib/redisTools";
import { is_prod_env } from "@/server/utils/evnutils";

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

  new CronJob(
    "0 1 * * *", // (cronTime) => at 1:00 AM
    cronJobs.CheckAllUsersBlock, // (onTick)   => function to run
    null, // (onComplete) => no special callback after job
    true, // (start) => start immediately
    null, // (timeZone) => e.g. "UTC" or your local
    null, // (context)
    false, // (runOnInit) => don't run immediately on app start
    null, // (utcOffset)
    false, // (unrefTimeout)
    true // (waitForCompletion) => wait for onTick to finish
    // No errorHandler passed
  );

  new CronJob(
    "*/1 * * * *", // (cronTime) =>  every minute
    cronJobs.generateInviteLinksCron, // (onTick)   => function to run
    null, // (onComplete) => no special callback after job
    true, // (start) => start immediately
    null, // (timeZone) => e.g. "UTC" or your local
    null, // (context)
    false, // (runOnInit) => don't run immediately on app start
    null, // (utcOffset)
    false, // (unrefTimeout)
    true // (waitForCompletion) => wait for onTick to finish
    // No errorHandler passed
  );

  new CronJob(
    "*/60 * * * * *", // Every 60 seconds
    cronJobs.consumeClickBatch, // The function to run
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
    "*/60 * * * * *", // Every 60 seconds
    cronJobs.updateAllTournaments, // The function to run
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
    "*/60 * * * * *", // Every 60 seconds
    cronJobs.sendPendingPromoCodes, // The function to run
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
    "*/60 * * * * *", // Every 60 seconds
    cronJobs.syncOngoingTournamentsLeaderboard, // The function to run
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
    "0 0 * * * *", // → 00:00, 01:00, 02:00 … (once per hour)
    cronJobs.syncPlay2WinScores,
    null, // onComplete
    true, // start immediately
    null, // timeZone (server default / UTC)
    null, // context
    false, // runOnInit – don’t run on startup
    null, // utcOffset
    false, // unrefTimeout
    true // waitForCompletion
  );

  if (is_prod_env()) {
    new CronJob(
      "* */10 * * * *", // Every 10 minutes
      cronJobs.updateAllUserWalletBalances, // The function to run
      null, // onComplete (not needed)
      true, // start immediately
      null, // timeZone
      null, // context
      false, // runOnInit => false (don't run on app start)
      null, // utcOffset => null
      false, // unrefTimeout => false
      true // waitForCompletion => true
    );
  }
}

MainCronJob().then(() => logger.log("Cron Jobs Started"));
