// checkBlockStatus.ts

import axios from "axios";
import { logger } from "@/server/utils/logger";
import { usersDB } from "@/db/modules/users.db";

// Pause execution for `ms` milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls your Telegram bot's /check-block-status endpoint for one user.
 * Retries up to 5 times if a 429 rate-limit error is encountered.
 */
async function requestCheckBlockStatus(userId: number, attempt = 1): Promise<void> {
  try {
    const response = await axios.post(
      `http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}/check-block-status`,
      {
        user_id: userId,
      }
    );
    logger.log(`Checked block status for user_id=${userId}`, response.data);
  } catch (error: any) {
    // If 429 Too Many Requests, wait and retry
    if (error?.response?.status === 429 && attempt <= 5) {
      const retryAfter = error?.response?.data?.retry_after ?? 1;
      logger.warn(`Rate limit 429 for user_id=${userId}, attempt #${attempt} - waiting ${retryAfter}s then retry...`);
      await sleep(retryAfter * 1000);
      return requestCheckBlockStatus(userId, attempt + 1);
    }

    // Other errors or too many retries
    logger.error(`Failed to check block status for user_id=${userId}, attempt #${attempt}:`, error?.message || error);
  }
}

/**
 * Example function that:
 * 1) Fetches users in batches (offset-based).
 * 2) For each user, calls /check-block-status (rate-limited to ~5 requests/sec).
 */
export const checkAllUsersBlockStatus = async (): Promise<void> => {
  logger.log("Starting block-status check for all users (offset-based)...");

  const batchSize = 2000; // you can adjust the batch size
  let offset = 0;

  while (true) {
    // 1) Fetch a batch of user IDs
    const batch = await usersDB.fetchUsersByOffset(offset, batchSize);
    if (batch.length === 0) {
      logger.log("No more users to process.");
      break; // No more users
    }

    logger.log(`Processing batch: offset=${offset}, fetched=${batch.length} users...`);

    // 2) For each user in this batch, check block status, then sleep 200ms
    for (const { user_id } of batch) {
      await requestCheckBlockStatus(user_id);
      await sleep(200); // 5 requests/sec
    }

    // Increase offset to fetch the next batch
    offset += batchSize;
  }

  logger.log("Finished block-status check for all users.");
};

export const CheckAllUsersBlock = async () => {
  logger.log("====> Running CheckAllUsersBlock");
  await checkAllUsersBlockStatus();
  logger.log("====> Completed CheckAllUsersBlock");
};
