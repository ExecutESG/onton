import callbackTasksDB from "@/db/modules/callbackTasks.db";
import { ApiTaskRouter } from "@/cronJobs/helper/apiTaskRouter";
import callbackTaskRunsDB from "@/db/modules/callbackTaskRuns.db";
import { CallBackTaskAPINameType, CallBackTaskFunctionType, CallBackTaskItemType } from "@/db/schema/callbackTasks";
import { logger } from "@/server/utils/logger";

export const callTaskImmediate = async (params: {
  apiName: CallBackTaskAPINameType;
  taskFunction: CallBackTaskFunctionType;
  payload: any;
  itemType?: CallBackTaskItemType | null;
  itemId?: number | null;
}): Promise<{ success: boolean; data: any }> => {
  const { apiName, taskFunction, payload, itemType, itemId } = params;

  // 1) Find the existing callback_tasks row or throw
  const task = await callbackTasksDB.findCallbackTaskStrict({
    apiName,
    taskFunction,
    itemType,
    itemId,
  });

  // 2) Lookup the handler in your ApiTaskRouter
  const handlerFn = ApiTaskRouter[apiName]?.[taskFunction];
  if (!handlerFn) {
    // If there's no direct handler => mark a run as FAILURE
    const errorData = { error: `No handler for ${apiName}/${taskFunction}` };
    await callbackTaskRunsDB.createRunRecord({
      callbackTaskId: task.id,
      status: "FAILURE",
      response: errorData,
      attempts: 1,
      payload,
    });
    logger.log(
      `No handler for ${apiName}/${taskFunction} and item=${itemType}/${itemId} with payload=${JSON.stringify(payload)}`
    );
    return { success: false, data: errorData };
  }

  // 3) Attempt the external call once
  let result: { success: boolean; data: any };
  try {
    result = await handlerFn(payload);
  } catch (err: any) {
    result = { success: false, data: { error: err.message } };
  }

  // 4) Insert a run record
  const attempts = 1; // first try
  if (result.success) {
    // Mark as success
    logger.log(
      `Success for ${apiName}/${taskFunction} and item=${itemType}/${itemId} with payload=${JSON.stringify(payload)}`
    );
    await callbackTaskRunsDB.createRunRecord({
      callbackTaskId: task.id,
      status: "SUCCESS",
      response: result.data,
      attempts,
      payload,
    });
  } else {
    // Mark as pending so cron can retry
    logger.log(
      `Pending for ${apiName}/${taskFunction} and item=${itemType}/${itemId} with payload=${JSON.stringify(payload)}`
    );
    await callbackTaskRunsDB.createRunRecord({
      callbackTaskId: task.id,
      status: "PENDING",
      response: result.data,
      attempts,
      payload,
    });
  }

  return result;
};
