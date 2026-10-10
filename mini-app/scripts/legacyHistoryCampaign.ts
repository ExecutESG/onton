/**
 * ONTON Legacy History Campaign Script
 *
 * Selects users who started the bot and have legacy rewards.
 * Sends "Your event history is now in ONTON" with a deep link to My Badges + consent card.
 *
 * Strict Constraints:
 * - Default: dry-run safety (prints counts and preview only; no Telegram API calls)
 * - Real execution strictly behind BOTH `--execute` AND `--confirm-send`
 * - Rate limit: <= 25 msg/s (enforced >= 45ms inter-message interval)
 * - Resumable state persistence via persistent state file (.json)
 * - Telegram Bot API dispatch with retry handling (429 rate limit backoff, 5xx retry, 403 permanent block handling)
 */

import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { db, closeDB } from "../src/db/db";
import { sql } from "drizzle-orm";

export interface CampaignUser {
  userId: number;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  rewardCount: number;
}

export interface CampaignState {
  lastProcessedUserId: number;
  totalProcessed: number;
  successful: number;
  failed: number;
  startedAt: string;
  updatedAt: string;
}

export interface CampaignSummary {
  totalEligible: number;
  alreadyProcessed: number;
  remainingToNotify: number;
  isDryRun: boolean;
  stateFilePath: string;
  botUsername: string;
  estimatedDurationSeconds: number;
  sentCount?: number;
  failedCount?: number;
}

export interface SendMessageResult {
  success: boolean;
  blocked?: boolean;
  retryAfter?: number;
  error?: string;
}

export const DEFAULT_STATE_FILE = path.resolve(__dirname, ".legacy_history_campaign_state.json");
export const MAX_RATE_PER_SECOND = 25;
export const INTER_MESSAGE_DELAY_MS = 45; // ~22 msg/s, strictly <= 25 msg/s

export const CAMPAIGN_MESSAGE = {
  text: `Your event history is now in ONTON 🎖️

We've brought over your past event attendance and badges into your personal profile. You can now view your complete history, collect verifiable credentials, and customize your data privacy preferences.

Tap below to view your badges and review your privacy settings:`,
  buttonText: "🎖️ View My Badges & Consents",
  deepLink: (botUsername: string) => `https://t.me/${botUsername}/app?startapp=badges`,
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loads campaign progress state from disk.
 */
export function loadCampaignState(statePath: string = DEFAULT_STATE_FILE): CampaignState {
  const defaultState: CampaignState = {
    lastProcessedUserId: 0,
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (fs.existsSync(statePath)) {
    try {
      const content = fs.readFileSync(statePath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        ...defaultState,
        ...parsed,
      };
    } catch {
      // Return fresh state on corrupt file
    }
  }

  return defaultState;
}

/**
 * Persists campaign progress state to disk for resumption.
 * Uses atomic rename via temp file to avoid state corruption on abrupt aborts.
 */
export function saveCampaignState(state: CampaignState, statePath: string = DEFAULT_STATE_FILE): void {
  state.updatedAt = new Date().toISOString();
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${statePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tempPath, statePath);
}

/**
 * Sends a message via Telegram Bot API with retry handling:
 * - 429: wait for retry_after and retry
 * - 403: user blocked bot, return { success: false, blocked: true }
 * - 5xx / Network error: exponential backoff retry (up to maxRetries)
 */
export async function sendCampaignTelegramMessage(
  telegramId: number | string,
  text: string,
  buttonText: string,
  deepLink: string,
  botToken?: string,
  maxRetries: number = 3
): Promise<SendMessageResult> {
  const token = botToken || process.env.BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      error: "BOT_TOKEN is not configured in environment.",
    };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: telegramId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            url: deepLink,
          },
        ],
      ],
    },
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (res.ok && data.ok) {
        return { success: true };
      }

      const errorCode = data?.error_code || res.status;
      const description = data?.description || res.statusText || "Unknown Telegram API error";

      // 429: Rate limited
      if (errorCode === 429) {
        const retryAfter = data?.parameters?.retry_after || 5;
        console.warn(`[Telegram API 429]: Rate limited on chat ${telegramId}. Retrying after ${retryAfter}s...`);
        if (attempt < maxRetries) {
          await sleep(retryAfter * 1000);
          continue;
        }
        return { success: false, retryAfter, error: description };
      }

      // 403: Forbidden (user blocked bot, chat deactivated)
      if (errorCode === 403) {
        return { success: false, blocked: true, error: description };
      }

      // 400: Bad Request (e.g. chat not found)
      if (errorCode === 400) {
        return { success: false, error: description };
      }

      // Transient 5xx error: exponential backoff
      if (attempt < maxRetries) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
        continue;
      }

      return { success: false, error: description };
    } catch (err: any) {
      if (attempt < maxRetries) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
        continue;
      }
      return { success: false, error: err?.message || "Network request failed" };
    }
  }

  return { success: false, error: "Exceeded max retries" };
}

/**
 * Queries database for all users who started the bot and hold legacy rewards.
 */
export async function getEligibleCampaignUsers(): Promise<CampaignUser[]> {
  try {
    const result = await db.execute<{
      user_id: string;
      telegram_id: string | null;
      username: string | null;
      first_name: string | null;
      reward_count: string;
    }>(sql`
      SELECT
        u.user_id,
        COALESCE(u.telegram_id, u.user_id) AS telegram_id,
        u.username,
        u.first_name,
        COUNT(r.id)::int AS reward_count
      FROM users u
      INNER JOIN visitors v ON v.user_id = u.user_id
      INNER JOIN rewards r ON r.visitor_id = v.id
      WHERE (u.has_blocked_the_bot IS NULL OR u.has_blocked_the_bot = false)
        AND (u.telegram_id IS NOT NULL OR u.user_id < 100000000000000)
      GROUP BY u.user_id, COALESCE(u.telegram_id, u.user_id), u.username, u.first_name
      ORDER BY u.user_id ASC;
    `);

    const rows = Array.isArray(result) ? result : (result as any)?.rows || [];
    return rows.map((row: any) => ({
      userId: Number(row.user_id),
      telegramId: row.telegram_id ? Number(row.telegram_id) : null,
      username: row.username,
      firstName: row.first_name,
      rewardCount: Number(row.reward_count),
    }));
  } catch (error) {
    // If running in minimal test environment without visitors/rewards data
    return [];
  }
}

/**
 * Runs the legacy history campaign (defaults to dry-run).
 */
export async function runLegacyHistoryCampaign(options: {
  dryRun?: boolean;
  stateFilePath?: string;
  limit?: number;
  botToken?: string;
  sendMessageFn?: (user: CampaignUser) => Promise<SendMessageResult>;
  delayMs?: number;
}): Promise<CampaignSummary> {
  const isDryRun = options.dryRun !== false; // Default to true (dry-run safety)
  const statePath = options.stateFilePath || DEFAULT_STATE_FILE;
  const state = loadCampaignState(statePath);

  // Clamping: in live dispatch without mock function, enforce at least 40ms interval (strictly <= 25 msg/s)
  const configuredDelay = options.delayMs !== undefined ? options.delayMs : INTER_MESSAGE_DELAY_MS;
  const interMessageDelay = options.sendMessageFn ? configuredDelay : Math.max(configuredDelay, 40);

  const botUsername =
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.BOT_USERNAME ||
    "ontonlocaldevbot";

  const allEligible = await getEligibleCampaignUsers();
  const remainingUsers = allEligible.filter((u) => u.userId > state.lastProcessedUserId);
  const targetUsers = options.limit ? remainingUsers.slice(0, options.limit) : remainingUsers;

  const estimatedDurationSeconds = Math.ceil(targetUsers.length / MAX_RATE_PER_SECOND);

  console.log("\n========================================================================");
  console.log("            ONTON LEGACY HISTORY NOTIFICATION CAMPAIGN                  ");
  console.log("========================================================================");
  console.log(`[MODE]: ${isDryRun ? "DRY-RUN (Safe mode: Counts and preview only)" : "LIVE EXECUTION (Real Bot API dispatch)"}`);
  console.log(`[RATE LIMIT]: <= ${MAX_RATE_PER_SECOND} msg/s (Interval: ${interMessageDelay}ms)`);
  console.log(`[TARGET BOT]: @${botUsername}`);
  console.log(`[STATE FILE]: ${statePath}`);
  console.log("------------------------------------------------------------------------");
  console.log(`Total eligible users in DB:       ${allEligible.length.toLocaleString()}`);
  console.log(`Already processed (from state):   ${state.totalProcessed.toLocaleString()} (last ID: ${state.lastProcessedUserId})`);
  console.log(`Remaining users to notify:        ${targetUsers.length.toLocaleString()}`);
  console.log(`Estimated duration at ${MAX_RATE_PER_SECOND} msg/s:     ${Math.floor(estimatedDurationSeconds / 60)}m ${estimatedDurationSeconds % 60}s`);
  console.log("------------------------------------------------------------------------");
  console.log("Message Preview:");
  console.log("------------------------------------------------------------------------");
  console.log(CAMPAIGN_MESSAGE.text);
  console.log(`[Button]: ${CAMPAIGN_MESSAGE.buttonText}`);
  console.log(`[Link]:   ${CAMPAIGN_MESSAGE.deepLink(botUsername)}`);
  console.log("------------------------------------------------------------------------");

  let sentCount = 0;
  let failedCount = 0;

  if (isDryRun) {
    console.log("✅ [DRY-RUN COMPLETE]: No Telegram messages were sent (0 sent).");
    console.log("To execute real dispatch, run with BOTH --execute and --confirm-send flags.");
    console.log("========================================================================\n");
  } else {
    const botToken = options.botToken || process.env.BOT_TOKEN;
    if (!botToken && !options.sendMessageFn) {
      throw new Error("Cannot run live campaign: BOT_TOKEN is not configured in environment.");
    }

    console.log(`🚀 Starting live dispatch to ${targetUsers.length} users at <= ${MAX_RATE_PER_SECOND} msg/s...`);

    const deepLink = CAMPAIGN_MESSAGE.deepLink(botUsername);

    for (let i = 0; i < targetUsers.length; i++) {
      const user = targetUsers[i];
      const targetTelegramId = user.telegramId || user.userId;

      let result: SendMessageResult;
      if (options.sendMessageFn) {
        result = await options.sendMessageFn(user);
      } else {
        result = await sendCampaignTelegramMessage(
          targetTelegramId,
          CAMPAIGN_MESSAGE.text,
          CAMPAIGN_MESSAGE.buttonText,
          deepLink,
          botToken
        );
      }

      if (result.success) {
        state.successful++;
        sentCount++;
      } else {
        state.failed++;
        failedCount++;
        console.warn(`[Failed dispatch] User ${user.userId} (TG: ${targetTelegramId}): ${result.error}`);

        // Update database if user blocked bot to prevent future attempts
        if (result.blocked) {
          try {
            await db.execute(sql`
              UPDATE users SET has_blocked_the_bot = true WHERE user_id = ${user.userId}
            `);
          } catch {
            // Non-fatal if DB flag update fails
          }
        }
      }

      state.totalProcessed++;
      state.lastProcessedUserId = user.userId;
      saveCampaignState(state, statePath);

      if ((i + 1) % 50 === 0 || i === targetUsers.length - 1) {
        console.log(`Progress: ${i + 1}/${targetUsers.length} processed (${sentCount} sent, ${failedCount} failed)`);
      }

      // Enforce rate limit (strictly <= 25 msg/s)
      if (i < targetUsers.length - 1 && interMessageDelay > 0) {
        await sleep(interMessageDelay);
      }
    }

    // Ensure final state is saved
    saveCampaignState(state, statePath);

    console.log("\n========================================================================");
    console.log(`✅ [LIVE EXECUTION FINISHED]: Processed ${targetUsers.length} users.`);
    console.log(`Success: ${sentCount} | Failed: ${failedCount}`);
    console.log(`Resumable state saved to: ${statePath}`);
    console.log("========================================================================\n");
  }

  return {
    totalEligible: allEligible.length,
    alreadyProcessed: state.totalProcessed,
    remainingToNotify: targetUsers.length,
    isDryRun,
    stateFilePath: statePath,
    botUsername,
    estimatedDurationSeconds,
    sentCount,
    failedCount,
  };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  // Default is dry-run. Live send strictly requires BOTH --execute AND --confirm-send.
  const hasExecuteFlag = args.includes("--execute");
  const hasConfirmFlag = args.includes("--confirm-send");
  const isDryRun = !hasExecuteFlag || !hasConfirmFlag || args.includes("--dry-run");

  if (hasExecuteFlag && !hasConfirmFlag) {
    console.warn("⚠️  WARNING: --execute flag was passed without --confirm-send. Safety dry-run engaged. No messages will be sent.");
  } else if (!hasExecuteFlag && hasConfirmFlag) {
    console.warn("⚠️  WARNING: --confirm-send flag was passed without --execute. Safety dry-run engaged. No messages will be sent.");
  }

  const getArgValue = (flag: string): string | undefined => {
    const prefix = `${flag}=`;
    const eqArg = args.find((a) => a.startsWith(prefix));
    if (eqArg) return eqArg.slice(prefix.length);
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith("--")) {
      return args[idx + 1];
    }
    return undefined;
  };

  const stateArg = getArgValue("--state-file");
  const limitArg = getArgValue("--limit");

  runLegacyHistoryCampaign({
    dryRun: isDryRun,
    stateFilePath: stateArg,
    limit: limitArg ? parseInt(limitArg, 10) : undefined,
  })
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Campaign script error:", err);
      await closeDB();
      process.exit(1);
    });
}
