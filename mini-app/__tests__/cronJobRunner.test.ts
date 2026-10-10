import { describe, it, expect, vi, beforeEach } from "vitest";
import { cronJobRunner } from "@/cronJobs/cornJobRunner";
import { redisTools } from "@/lib/redisTools";
import { sendLogNotification } from "@/lib/tgBot";

vi.mock("@/lib/tgBot", () => ({
  sendLogNotification: vi.fn().mockResolvedValue({ message_id: 1 }),
}));

vi.mock("@/lib/redisTools", () => {
  const store = new Map<string, any>();
  const ttls = new Map<string, number>();

  return {
    redisTools: {
      cacheKeys: {
        cronJobLock: "cronJobLock:",
      },
      getCache: vi.fn(async (key: string) => store.get(key)),
      setCache: vi.fn(async (key: string, value: any, ttl?: number) => {
        store.set(key, value);
        if (ttl) ttls.set(key, ttl);
      }),
      deleteCache: vi.fn(async (key: string) => {
        store.delete(key);
        ttls.delete(key);
      }),
      getRedisKeyTTL: vi.fn(async (key: string) => ttls.get(key) || 900),
      setRedisKeyTTL: vi.fn().mockResolvedValue(true),
      __store: store,
      __ttls: ttls,
    },
  };
});

describe("cronJobRunner alert rate-limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (redisTools as any).__store.clear();
    (redisTools as any).__ttls.clear();
  });

  it("runs successfully and releases lock without alerting", async () => {
    const mockTask = vi.fn().mockResolvedValue("success");
    Object.defineProperty(mockTask, "name", { value: "TestSuccessCron" });

    const runner = cronJobRunner(mockTask);
    await runner();

    expect(mockTask).toHaveBeenCalledTimes(1);
    expect(sendLogNotification).not.toHaveBeenCalled();
    expect(redisTools.deleteCache).toHaveBeenCalledWith("cronJobLock:TestSuccessCron");
  });

  it("sends notification on first error and suppresses immediate repeated errors", async () => {
    const failingTask = vi.fn().mockRejectedValue(new Error("Database connection lost"));
    Object.defineProperty(failingTask, "name", { value: "TestFailingCron" });

    const runner = cronJobRunner(failingTask);

    // Run 1: Should send Telegram alert
    await runner();
    expect(sendLogNotification).toHaveBeenCalledTimes(1);
    expect(sendLogNotification).toHaveBeenCalledWith({
      message: "Cron job TestFailingCron error: Database connection lost",
      topic: "system",
    });

    // Run 2: Immediately within cooldown -> should suppress notification
    await runner();
    expect(sendLogNotification).toHaveBeenCalledTimes(1); // Still 1

    // Run 3: Still within cooldown -> should suppress notification
    await runner();
    expect(sendLogNotification).toHaveBeenCalledTimes(1); // Still 1
  });

  it("increments repetition counter during suppression", async () => {
    const failingTask = vi.fn().mockRejectedValue(new Error("Persistent error"));
    Object.defineProperty(failingTask, "name", { value: "TestCounterCron" });

    const runner = cronJobRunner(failingTask);

    await runner(); // Run 1
    await runner(); // Run 2
    await runner(); // Run 3

    // Check store in redisTools
    const entries = Array.from<[string, any]>((redisTools as any).__store.entries());
    const repeatEntry = entries.find(([key]) => key.startsWith("cron_alert_repeat:TestCounterCron:"));
    expect(repeatEntry).toBeDefined();
    expect(repeatEntry?.[1]?.count).toBe(3);
  });
});
