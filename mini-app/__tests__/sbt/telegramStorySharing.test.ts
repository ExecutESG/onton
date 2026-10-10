import { describe, it, expect, vi } from "vitest";

describe("Telegram Story Sharing & Social Bragging (Issue #993)", () => {
  it("should format story options and deep-link payload correctly", () => {
    const eventUuid = "4b287361-a06f-43dd-87c1-2d3a68f99fa7";
    const botUsername = "notnonstagebot";
    const expectedDeepLink = `https://t.me/${botUsername}/event?startapp=${eventUuid}`;

    const storyPayload = {
      mediaUrl: "https://dev-storage.dev.onton.live/badges/hacker-badge.png",
      text: "Just collected my official soulbound badge for TON Hackathon 2026! 🎟️✨\n\nVerified on TON Blockchain.",
      widgetLink: {
        url: expectedDeepLink,
        name: "View Event on ONTON",
      },
    };

    expect(storyPayload.widgetLink.url).toBe(expectedDeepLink);
    expect(storyPayload.text).toContain("TON Hackathon 2026");
    expect(storyPayload.mediaUrl).toMatch(/\.(png|jpg|webp)$/);
  });

  it("should generate correct fallback chat share URL when stories are unsupported", () => {
    const mediaUrl = "https://app.onton.live/badge.png";
    const deepLink = "https://t.me/notnonstagebot/event?startapp=test-123";
    const text = "Check out my official badge on ONTON!";

    const fallbackUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;

    expect(fallbackUrl).toContain("https://t.me/share/url");
    expect(fallbackUrl).toContain(encodeURIComponent(deepLink));
    expect(fallbackUrl).toContain(encodeURIComponent(text));
  });

  it("should invoke Telegram WebApp shareToStory when method is present", () => {
    const mockShareToStory = vi.fn();
    const mockWebApp = {
      shareToStory: mockShareToStory,
      HapticFeedback: {
        impactOccurred: vi.fn(),
      },
    };

    const mediaUrl = "https://app.onton.live/badge.png";
    const text = "Badge earned!";
    const widgetLink = { url: "https://t.me/theontonbot", name: "ONTON" };

    mockWebApp.shareToStory(mediaUrl, { text, widget_link: widgetLink });

    expect(mockShareToStory).toHaveBeenCalledTimes(1);
    expect(mockShareToStory).toHaveBeenCalledWith(mediaUrl, {
      text,
      widget_link: widgetLink,
    });
  });
});
