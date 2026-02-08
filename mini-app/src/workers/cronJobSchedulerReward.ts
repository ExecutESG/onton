import { getErrorMessages } from "@/lib/error";
import { CronJob } from "cron";
import "dotenv/config";
import { logger } from "@/server/utils/logger";
import "@/lib/gracefullyShutdown";
import cronJobs, { cronJobRunner } from "@/cronJobs";
import { redisTools } from "@/lib/redisTools";
import { processRecentlyEndedTournaments } from "@/cronJobs/tasks/tournamentRewards";
import { is_prod_env, is_stage_env } from "@/server/utils/evnutils";

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
  new CronJob("*/1 * * * *", cronJobRunner(cronJobs.CreateRewards), null, true);
  new CronJob("*/3 * * * *", cronJobRunner(cronJobs.notifyUsersForRewards), null, true);

  if (is_prod_env()) {
    new CronJob("0 4 * * * *", cronJobs.syncSbtCollectionsForEvents, null, true); // has been disabled because of high rate limit usage
    new CronJob(
      "*/60 * * * *", // (cronTime) =>  every hour
      cronJobs.CheckSbtStatus, // (onTick)   => function to run
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
  }

  new CronJob(
    "*/5 * * * *", // (cronTime) =>  every 5 minutes
    cronJobs.processRecentlyEndedTournaments, // (onTick)   => function to run
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
    "*/2 * * * *", // (cronTime) =>  every 2 minutes
    cronJobs.sendTournamentRewardsNotifications, // (onTick)   => function to run
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
    "*/1 * * * *", // (cronTime) =>  every 5 minutes
    cronJobs.checkAndEnrollUserInPlay2WinCampaign, // (onTick)   => function to run
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
}

MainCronJob().then(() => logger.log("Cron Jobs Started"));
