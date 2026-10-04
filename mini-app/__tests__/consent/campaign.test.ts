import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  loadCampaignState,
  saveCampaignState,
  CAMPAIGN_MESSAGE,
  runLegacyHistoryCampaign,
} from "../../scripts/legacyHistoryCampaign";

const TEST_STATE_FILE = path.resolve(__dirname, ".test_campaign_state.json");

vi.mock("@/db/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([
      {
        user_id: "101",
        telegram_id: "101",
        username: "alice",
        first_name: "Alice",
        reward_count: "5",
      },
      {
        user_id: "102",
        telegram_id: "102",
        username: "bob",
        first_name: "Bob",
        reward_count: "2",
      },
    ]),
  },
  closeDB: vi.fn().mockResolvedValue(undefined),
}));

describe("Legacy History Campaign Script", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_FILE)) {
      fs.unlinkSync(TEST_STATE_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_FILE)) {
      fs.unlinkSync(TEST_STATE_FILE);
    }
  });

  it("loadCampaignState initializes fresh state when file does not exist", () => {
    const state = loadCampaignState(TEST_STATE_FILE);
    expect(state.lastProcessedUserId).toBe(0);
    expect(state.totalProcessed).toBe(0);
    expect(state.successful).toBe(0);
    expect(state.failed).toBe(0);
    expect(state.startedAt).toBeDefined();
  });

  it("saveCampaignState and loadCampaignState round trip works", () => {
    const state = {
      lastProcessedUserId: 500,
      totalProcessed: 10,
      successful: 9,
      failed: 1,
      startedAt: "2026-10-04T12:00:00.000Z",
      updatedAt: "2026-10-04T12:00:00.000Z",
    };

    saveCampaignState(state, TEST_STATE_FILE);
    expect(fs.existsSync(TEST_STATE_FILE)).toBe(true);

    const loaded = loadCampaignState(TEST_STATE_FILE);
    expect(loaded.lastProcessedUserId).toBe(500);
    expect(loaded.totalProcessed).toBe(10);
    expect(loaded.successful).toBe(9);
    expect(loaded.failed).toBe(1);
  });

  it("CAMPAIGN_MESSAGE generates correct text and deep link", () => {
    expect(CAMPAIGN_MESSAGE.text).toContain("Your event history is now in ONTON");
    expect(CAMPAIGN_MESSAGE.buttonText).toBe("🎖️ View My Badges & Consents");
    const link = CAMPAIGN_MESSAGE.deepLink("theontonbot");
    expect(link).toBe("https://t.me/theontonbot/app?startapp=badges");
  });

  it("runLegacyHistoryCampaign defaults to dry-run and calculates correct counts", async () => {
    const summary = await runLegacyHistoryCampaign({
      dryRun: true,
      stateFilePath: TEST_STATE_FILE,
    });

    expect(summary.isDryRun).toBe(true);
    expect(summary.totalEligible).toBe(2);
    expect(summary.remainingToNotify).toBe(2);
    expect(summary.alreadyProcessed).toBe(0);
    expect(summary.estimatedDurationSeconds).toBeGreaterThanOrEqual(1);
  });

  it("runLegacyHistoryCampaign honors resumption state", async () => {
    saveCampaignState(
      {
        lastProcessedUserId: 101, // user 101 already processed
        totalProcessed: 1,
        successful: 1,
        failed: 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      TEST_STATE_FILE
    );

    const summary = await runLegacyHistoryCampaign({
      dryRun: true,
      stateFilePath: TEST_STATE_FILE,
    });

    expect(summary.totalEligible).toBe(2);
    expect(summary.alreadyProcessed).toBe(1);
    expect(summary.remainingToNotify).toBe(1); // Only user 102 left
  });
});
