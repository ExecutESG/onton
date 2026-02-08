import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";
import callbackTasksDB from "@/db/modules/callbackTasks.db";
import callbackTaskRunsDB from "@/db/modules/callbackTaskRuns.db";
import { ApiTaskRouter } from "@/cronJobs/helper/apiTaskRouter";
import { enforceDistributedRateLimit, recordDistributedRequest } from "@/lib/distributedRequestRateLimiter";

const BATCH_SIZE = 100; // how many tasks per DB query

/**
 * Process a single batch of runs (one attempt per run).
 */
async function processBatchOfRuns(runs: any[], processedRuns: Set<number>) {
  for (const run of runs) {
    if (processedRuns.has(run.id)) {
      // Already processed this run in this invocation
      continue;
    }
    processedRuns.add(run.id);

    const lockKey = `callback-task-run-lock:${run.run_uuid}`;
    const lockAcquired = await redisTools.acquireLock(lockKey, 30); // 30s lock
    if (!lockAcquired) {
      logger.warn(`Lock not acquired for run_uuid=${run.run_uuid}. Possibly processed elsewhere.`);
      continue;
    }

    try {
      // 1) Fetch the parent callbackTask
      const task = await callbackTasksDB.fetchCallbackTaskById(run.callback_task_id);
      if (!task) {
        logger.error(`No matching callbackTasks found for run_uuid=${run.run_uuid}`);
        await callbackTaskRunsDB.updateCallbackTaskRun(run.id, {
          status: "FAILURE",
          response: { error: "Callback task not found" },
          next_run_at: new Date(),
        });
        continue;
      }

      // 2) Rate limit (5 RPS, distributed)
      await enforceDistributedRateLimit(task.api_name);

      // 3) Prepare payload
      const finalPayload = run.payload ?? task.payload_template;
      logger.info(
        `Processing run_uuid=${run.run_uuid} [api=${task.api_name}] attempt #${run.attempts + 1} , payload:`,
        finalPayload
      );

      // 4) Lookup the handler
      const handlerFn = ApiTaskRouter[task.api_name]?.[task.task_function];
      if (!handlerFn) {
        logger.error(`No handler function for api=${task.api_name}, func=${task.task_function}`);
        await callbackTaskRunsDB.updateCallbackTaskRun(run.id, {
          status: "FAILURE",
          response: { error: "No handler function for this task" },
          next_run_at: new Date(),
        });
        continue;
      }

      // 5) Spend a rate-limit slot
      await recordDistributedRequest(task.api_name);

      // 6) Execute once
      const { success, data } = await handlerFn(finalPayload);

      // 7) Update attempts/status
      const policy = task.retry_policy || {};
      const maxAttempts = policy.max_attempt ?? 3;
      const waitForRetry = policy.wait_for_retry ?? 0; // e.g. 3000 ms
      const newAttempts = run.attempts + 1;

      if (success) {
        // Mark success
        await callbackTaskRunsDB.updateCallbackTaskRun(run.id, {
          status: "SUCCESS",
          response: data,
          attempts: newAttempts,
          next_run_at: new Date(), // or null
        });
        logger.info(`run_uuid=${run.run_uuid} succeeded on attempt #${newAttempts}.`);
      } else {
        // Failure
        if (newAttempts >= maxAttempts) {
          // Mark FAILURE permanently
          await callbackTaskRunsDB.updateCallbackTaskRun(run.id, {
            status: "FAILURE",
            response: data,
            attempts: newAttempts,
            next_run_at: new Date(), // or null
          });
          logger.warn(`run_uuid=${run.run_uuid} permanent FAILURE (attempts=${newAttempts} >= max=${maxAttempts}).`);
        } else {
          // Remain PENDING, but set next_run_at to the future
          const nextRunDate = new Date(Date.now() + waitForRetry);
          await callbackTaskRunsDB.updateCallbackTaskRun(run.id, {
            status: "PENDING",
            response: data,
            attempts: newAttempts,
            next_run_at: nextRunDate,
          });
          logger.warn(
            `run_uuid=${run.run_uuid} attempt #${newAttempts} failed; leaving PENDING until ${nextRunDate}.`,
            data
          );
        }
      }
    } catch (err) {
      logger.error(`Error processing run_uuid=${run.run_uuid}`, err);
    } finally {
      await redisTools.deleteCache(lockKey);
    }
  }
}

/**
 * Main function - Paginate through *all* pending tasks, one attempt each.
 * We do NOT re-fetch tasks that remain pending in the same run.
 * The next cron invocation will handle re-tries, but only if next_run_at <= now.
 */
export async function runPendingCallbackTasks() {
  try {
    const processedRuns = new Set<number>();

    while (true) {
      // 1) Fetch up to BATCH_SIZE tasks where status='PENDING' AND next_run_at <= now()
      const pendingRuns = await callbackTaskRunsDB.fetchPendingCallbackRuns(BATCH_SIZE);

      // Filter out any we've processed this invocation
      const newRuns = pendingRuns.filter((r) => !processedRuns.has(r.id));
      if (newRuns.length === 0) {
        // logger.debug("No newly unprocessed pending runs found; finishing.");
        break;
      }

      logger.debug(`Processing batch of size=${newRuns.length} (from total pending=${pendingRuns.length}).`);
      await processBatchOfRuns(newRuns, processedRuns);

      // If newRuns was smaller than BATCH_SIZE, we might have exhausted the table
      // We'll continue the loop until no new tasks appear
    }
  } catch (err) {
    logger.error("Error in runPendingCallbackTasks:", err);
  }
}
