import { db } from "@/db/db";
import { callbackTaskRuns, callbackTaskRunStatusEnum, callbackTaskRunStatusType } from "@/db/schema/callbackTaskRuns";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { CallbackTaskRunsRow } from "@/db/schema/callbackTaskRuns";
import { addUserTicketFromOnton } from "@/cronJobs/helper/tonfestHandlers";

const MAX_ATTEMPTS = 3;

/**
 *  Fetch pending callbackTaskRuns that are due to run.
 */
export const fetchPendingCallbackRuns = async (limitValue: number = 10) => {
  const now = new Date();
  return db
    .select()
    .from(callbackTaskRuns)
    .where(
      // (status = 'PENDING') AND (next_run_at <= now)
      and(
        eq(callbackTaskRuns.status, "PENDING"),
        or(lte(callbackTaskRuns.next_run_at, now), isNull(callbackTaskRuns.next_run_at))
      )
    )
    .limit(limitValue);
};

/**
 * Update the status/response of a callbackTaskRun by ID.
 *
 * @param runId - The primary key (id) of the callbackTaskRun
 * @param data - Partial data to update (e.g. status, response, attempts)
 */
export const updateCallbackTaskRun = async (runId: number, data: Partial<CallbackTaskRunsRow>): Promise<void> => {
  await db.update(callbackTaskRuns).set(data).where(eq(callbackTaskRuns.id, runId));
};

/**
 * Determine the updated status given the current attempt count.
 */
export const computeNextStatus = (currentAttempts: number): callbackTaskRunStatusType => {
  const newAttempts = currentAttempts + 1;
  return newAttempts >= MAX_ATTEMPTS
    ? callbackTaskRunStatusEnum.enumValues[2] // 'FAILURE'
    : callbackTaskRunStatusEnum.enumValues[0]; // 'PENDING'
};

/**
 * Insert a new row in callback_task_runs with the given status & data.
 */
const createRunRecord = async (params: {
  callbackTaskId: number;
  status: "SUCCESS" | "PENDING" | "FAILURE";
  response: any;
  attempts: number;
  payload: any;
}) => {
  const { callbackTaskId, status, response, attempts, payload } = params;
  await db.insert(callbackTaskRuns).values({
    callback_task_id: callbackTaskId,
    status,
    response,
    attempts,
    payload,
  });
};
const callbackTaskRunsDB = {
  fetchPendingCallbackRuns,
  updateCallbackTaskRun,
  computeNextStatus,
  createRunRecord,
};
export default callbackTaskRunsDB;
