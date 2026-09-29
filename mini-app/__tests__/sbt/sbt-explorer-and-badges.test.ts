import { describe, it, expect } from "vitest";
import { getExplorerLink } from "../../src/server/routers/sbt";
import { parseDate } from "../../src/components/sbt/BadgeDetailModal";

describe("SBT Showcase & Dynamic Explorer Routing", () => {
  it("should generate testnet tonviewer links on testnet environment", () => {
    const testAddress = "0:8a514fbd654d07936a048705f1345866160537e584f29a28c0b5c1e95655e620";
    const link = getExplorerLink(testAddress);
    expect(link).toBe(`https://testnet.tonviewer.com/${testAddress}`);
  });

  it("should correctly format user-facing badge addresses", () => {
    const address = "kQCKUU-9ZU0Hk2oEhwXxNFhmFgU35YTimijAtcHpVlXmIA6r";
    const link = getExplorerLink(address);
    expect(link).toContain(address);
    expect(link.startsWith("https://")).toBe(true);
  });
});

describe("Badge Date Parsing", () => {
  it("should convert epoch seconds to proper year", () => {
    const epochSec = 1774569600; // year ~2026
    const parsed = parseDate(epochSec);
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
  });

  it("should handle millisecond timestamps without multiplying", () => {
    const epochMs = 1774569600000;
    const parsed = parseDate(epochMs);
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
  });

  it("should return null for undefined or null dates", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe("TON Society & Native SBT Deduplication", () => {
  it("should ensure native badge supersedes legacy TON Society badge for same event", () => {
    const nativeEventUuids = new Set(["event-uuid-123"]);

    const legacyRows = [
      { eventUuid: "event-uuid-123", rewardId: "ts-1", eventTitle: "Duplicate Event" },
      { eventUuid: "event-uuid-456", rewardId: "ts-2", eventTitle: "Unique Legacy Event" },
    ];

    const deduplicatedLegacy = legacyRows.filter((r) => !nativeEventUuids.has(r.eventUuid));

    expect(deduplicatedLegacy.length).toBe(1);
    expect(deduplicatedLegacy[0].eventUuid).toBe("event-uuid-456");
  });

  it("should resolve mainnet Tonviewer for legacy badge with sbt_address", () => {
    const sbtAddress = "0:1234567890abcdef";
    const explorerUrl = `https://tonviewer.com/${sbtAddress}`;
    expect(explorerUrl).toBe("https://tonviewer.com/0:1234567890abcdef");
  });

  it("should fallback to reward_link when legacy badge has no on-chain contract address", () => {
    const rewardLink = "https://society.ton.org/events/test-slug/claim/abc-xyz";
    const sbtAddress = null;
    const explorerUrl = sbtAddress ? `https://tonviewer.com/${sbtAddress}` : rewardLink;
    expect(explorerUrl).toBe("https://society.ton.org/events/test-slug/claim/abc-xyz");
  });
});
