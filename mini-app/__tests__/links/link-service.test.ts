import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LinkService } from "@/lib/links/linkService";

describe("LinkService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_BOT_USERNAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("generates default universal web URL for an event", () => {
    const url = LinkService.getEventUrl("evt-12345");
    expect(url).toBe("https://onton.live/events/evt-12345");
  });

  it("respects NEXT_PUBLIC_APP_URL environment variable", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.dev.onton.live";
    const url = LinkService.getEventUrl("evt-12345");
    expect(url).toBe("https://app.dev.onton.live/events/evt-12345");
  });

  it("appends UTM parameters and referral codes cleanly", () => {
    const url = LinkService.getEventUrl("evt-12345", {
      ref: "partner42",
      utm_source: "twitter",
      utm_medium: "social",
      utm_campaign: "launch",
    });

    expect(url).toContain("https://onton.live/events/evt-12345?");
    expect(url).toContain("ref=partner42");
    expect(url).toContain("utm_source=twitter");
    expect(url).toContain("utm_medium=social");
    expect(url).toContain("utm_campaign=launch");
  });

  it("generates Telegram deep link when forceTelegram is true", () => {
    process.env.NEXT_PUBLIC_BOT_USERNAME = "myontonbot";
    const url = LinkService.getEventUrl("evt-12345", { forceTelegram: true });
    expect(url).toBe("https://t.me/myontonbot/event?startapp=evt-12345");
  });

  it("detects Telegram user agents accurately", () => {
    const tgUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram/10.0";
    const chromeUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    expect(LinkService.isTelegramUserAgent(tgUA)).toBe(true);
    expect(LinkService.isTelegramUserAgent(chromeUA)).toBe(false);
    expect(LinkService.isTelegramUserAgent(undefined)).toBe(false);
  });

  it("resolves smart event link to Telegram inside Telegram and web outside", () => {
    process.env.NEXT_PUBLIC_BOT_USERNAME = "ontonbot";
    const tgUA = "Telegram/10.0 (iPhone; iOS 17.0)";
    const safariUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

    const tgLink = LinkService.resolveSmartEventLink("evt-xyz", tgUA);
    expect(tgLink).toBe("https://t.me/ontonbot/event?startapp=evt-xyz");

    const webLink = LinkService.resolveSmartEventLink("evt-xyz", safariUA);
    expect(webLink).toBe("https://onton.live/events/evt-xyz");
  });

  it("generates channel and tournament URLs", () => {
    expect(LinkService.getChannelUrl("tech-hub")).toBe("https://onton.live/channels/tech-hub");
    expect(LinkService.getTournamentUrl(42)).toBe("https://onton.live/tournaments/42");
    expect(LinkService.getAffiliateUrl("aff-hash-789")).toBe("https://onton.live/join/aff-hash-789");
  });
});
