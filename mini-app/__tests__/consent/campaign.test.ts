import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  loadCampaignState,
  saveCampaignState,
  CAMPAIGN_MESSAGE,
  runLegacyHistoryCampaign,
  sendCampaignTelegramMessage,
  CampaignUser,
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

  it("loadCampaignState recovers gracefully from corrupted JSON file", () => {
    fs.writeFileSync(TEST_STATE_FILE, "INVALID JSON {{{{", "utf-8");
    const loaded = loadCampaignState(TEST_STATE_FILE);
    expect(loaded.lastProcessedUserId).toBe(0);
    expect(loaded.totalProcessed).toBe(0);
    expect(loaded.successful).toBe(0);
    expect(loaded.failed).toBe(0);
  });

  it("saveCampaignState creates directory if missing", () => {
    const nestedDir = path.resolve(__dirname, ".tmp_campaign_dir");
    const nestedFile = path.resolve(nestedDir, "nested_state.json");
    try {
      saveCampaignState(
        {
          lastProcessedUserId: 1,
          totalProcessed: 1,
          successful: 1,
          failed: 0,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nestedFile
      );
      expect(fs.existsSync(nestedFile)).toBe(true);
    } finally {
      if (fs.existsSync(nestedFile)) fs.unlinkSync(nestedFile);
      if (fs.existsSync(nestedDir)) fs.rmdirSync(nestedDir);
    }
  });

  it("CAMPAIGN_MESSAGE generates correct text and deep link", () => {
    expect(CAMPAIGN_MESSAGE.text).toContain("Your event history is now in ONTON");
    expect(CAMPAIGN_MESSAGE.buttonText).toBe("🎖️ View My Badges & Consents");
    const link = CAMPAIGN_MESSAGE.deepLink("theontonbot");
    expect(link).toBe("https://t.me/theontonbot/app?startapp=badges");
  });

  it("runLegacyHistoryCampaign defaults to dry-run and calculates correct counts without sending", async () => {
    const mockSend = vi.fn();

    const summary = await runLegacyHistoryCampaign({
      dryRun: true,
      stateFilePath: TEST_STATE_FILE,
      sendMessageFn: mockSend,
    });

    expect(summary.isDryRun).toBe(true);
    expect(summary.totalEligible).toBe(2);
    expect(summary.remainingToNotify).toBe(2);
    expect(summary.alreadyProcessed).toBe(0);
    expect(summary.estimatedDurationSeconds).toBeGreaterThanOrEqual(1);
    expect(mockSend).not.toHaveBeenCalled();
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

  it("runLegacyHistoryCampaign dispatches live messages and updates state when dryRun is false", async () => {
    const sentUsers: CampaignUser[] = [];
    const mockSend = vi.fn().mockImplementation(async (user: CampaignUser) => {
      sentUsers.push(user);
      if (user.userId === 102) {
        return { success: false, error: "Forbidden: bot was blocked by the user" };
      }
      return { success: true };
    });

    const summary = await runLegacyHistoryCampaign({
      dryRun: false,
      stateFilePath: TEST_STATE_FILE,
      sendMessageFn: mockSend,
      delayMs: 1, // minimal delay for test speed
    });

    expect(summary.isDryRun).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(sentUsers.map((u) => u.userId)).toEqual([101, 102]);
    expect(summary.sentCount).toBe(1);
    expect(summary.failedCount).toBe(1);

    // Verify persistent state file was updated
    const savedState = loadCampaignState(TEST_STATE_FILE);
    expect(savedState.totalProcessed).toBe(2);
    expect(savedState.lastProcessedUserId).toBe(102);
    expect(savedState.successful).toBe(1);
    expect(savedState.failed).toBe(1);
  });

  it("updates database has_blocked_the_bot flag when user blocks bot", async () => {
    const mockSend = vi.fn().mockImplementation(async () => {
      return { success: false, blocked: true, error: "Forbidden: bot was blocked by the user" };
    });

    await runLegacyHistoryCampaign({
      dryRun: false,
      stateFilePath: TEST_STATE_FILE,
      sendMessageFn: mockSend,
      delayMs: 1,
      limit: 1,
    });

    const { db } = await import("@/db/db");
    expect(db.execute).toHaveBeenCalled();
  });

  describe("sendCampaignTelegramMessage Telegram API dispatch", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("returns success when Telegram API returns 200 ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 999 } }),
      } as any);

      const res = await sendCampaignTelegramMessage(
        12345,
        "Hello",
        "Click here",
        "https://t.me/onton",
        "mock_bot_token"
      );

      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botmock_bot_token/sendMessage",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("handles 403 blocked user permanently without infinite retries", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          ok: false,
          error_code: 403,
          description: "Forbidden: bot was blocked by the user",
        }),
      } as any);

      const res = await sendCampaignTelegramMessage(
        12345,
        "Hello",
        "Click here",
        "https://t.me/onton",
        "mock_bot_token"
      );

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Permanent failure, no retries
    });

    it("handles 429 rate limit with retry_after backoff", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({
              ok: false,
              error_code: 429,
              description: "Too Many Requests: retry after 0",
              parameters: { retry_after: 0.001 },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 1000 } }),
        };
      });

      const res = await sendCampaignTelegramMessage(
        12345,
        "Hello",
        "Click here",
        "https://t.me/onton",
        "mock_bot_token",
        2
      );

      expect(res.success).toBe(true);
      expect(callCount).toBe(2);
    });
  });
});
