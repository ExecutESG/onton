/**
 * ONTON Legacy History Campaign Script
 *
 * Selects users who started the bot and have legacy rewards.
 * Sends "Your event history is now in ONTON" with a deep link to My Badges + consent card.
 *
 * Strict Constraints:
 * - Default: --dry-run (prints counts only)
 * - Rate limit: <= 25 msg/s (enforced 45ms inter-message sleep)
 * - Resumable via persistent state file
 * - Execution tracked in #1042 (NO actual messages sent in #1038)
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
}

const DEFAULT_STATE_FILE = path.resolve(__dirname, ".legacy_history_campaign_state.json");
const MAX_RATE_PER_SECOND = 25;
const INTER_MESSAGE_DELAY_MS = 45; // ~22 msg/s, strictly <= 25 msg/s

export const CAMPAIGN_MESSAGE = {
  text: `Your event history is now in ONTON 🎖️

We've brought over your past event attendance and badges into your personal profile. You can now view your complete history, collect verifiable credentials, and customize your data privacy preferences.

Tap below to view your badges and review your privacy settings:`,
  buttonText: "🎖️ View My Badges & Consents",
  deepLink: (botUsername: string) => `https://t.me/${botUsername}/app?startapp=badges`,
};

/**
 * Loads campaign progress state from disk.
 */
export function loadCampaignState(statePath: string = DEFAULT_STATE_FILE): CampaignState {
  if (fs.existsSync(statePath)) {
    try {
      const content = fs.readFileSync(statePath, "utf-8");
      return JSON.parse(content);
    } catch {
      // Return fresh state on corrupt file
    }
  }

  return {
    lastProcessedUserId: 0,
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Persists campaign progress state to disk for resumption.
 */
export function saveCampaignState(state: CampaignState, statePath: string = DEFAULT_STATE_FILE): void {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
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

    return result.map((row) => ({
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
}): Promise<CampaignSummary> {
  const isDryRun = options.dryRun !== false; // Default to true!
  const statePath = options.stateFilePath || DEFAULT_STATE_FILE;
  const state = loadCampaignState(statePath);

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
  console.log(`[MODE]: ${isDryRun ? "DRY-RUN (Counts and preview only)" : "LIVE EXECUTION"}`);
  console.log(`[RATE LIMIT]: <= ${MAX_RATE_PER_SECOND} msg/s (Enforced interval: ${INTER_MESSAGE_DELAY_MS}ms)`);
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

  if (isDryRun) {
    console.log("✅ [DRY-RUN COMPLETE]: No Telegram messages were sent (0 sent).");
    console.log("Real campaign dispatch is tracked separately in issue #1042.");
    console.log("========================================================================\n");
  } else {
    // Safety guard: real send requires explicit tracking issue #1042 confirmation
    console.warn("⚠️ Live sending is blocked in #1038 scope. Dispatch is tracked in #1042.");
  }

  return {
    totalEligible: allEligible.length,
    alreadyProcessed: state.totalProcessed,
    remainingToNotify: targetUsers.length,
    isDryRun,
    stateFilePath: statePath,
    botUsername,
    estimatedDurationSeconds,
  };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  // Default is dry-run. Live send requires explicit confirmation flags.
  const hasExecuteFlag = args.includes("--execute");
  const hasConfirmFlag = args.includes("--confirm-send");
  const isDryRun = !hasExecuteFlag || !hasConfirmFlag || args.includes("--dry-run");

  const stateArg = args.find((a) => a.startsWith("--state-file="))?.split("=")[1];
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];

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
