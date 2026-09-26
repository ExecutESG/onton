import { describe, it, expect } from "vitest";
import { resolveDeepLink } from "../../../telegram-bot/src/utils/deepLink";

describe("Universal Telegram Bot Deep Link Resolution (Issue #968)", () => {
  const BASE_URL = "https://app.onton.live";

  it("DL-1: resolves standard event prefix with Open Event button", () => {
    const res = resolveDeepLink("event_4b287361-a06f-43dd-87c1-2d3a68f99fa7", BASE_URL);
    expect(res).not.toBeNull();
    expect(res?.targetUrl).toBe("https://app.onton.live/events/4b287361-a06f-43dd-87c1-2d3a68f99fa7");
    expect(res?.buttonText).toBe("Open Event");
  });

  it("DL-2: resolves event with referral attribution suffix (_ref_)", () => {
    const res = resolveDeepLink("event_4b287361-a06f-43dd-87c1-2d3a68f99fa7_ref_partner123", BASE_URL);
    expect(res).not.toBeNull();
    expect(res?.targetUrl).toBe("https://app.onton.live/events/4b287361-a06f-43dd-87c1-2d3a68f99fa7?ref=partner123");
    expect(res?.buttonText).toBe("Open Event");
  });

  it("DL-3: resolves raw event UUID without event_ prefix", () => {
    const res = resolveDeepLink("4b287361-a06f-43dd-87c1-2d3a68f99fa7", BASE_URL);
    expect(res).not.toBeNull();
    expect(res?.targetUrl).toBe("https://app.onton.live/events/4b287361-a06f-43dd-87c1-2d3a68f99fa7");
    expect(res?.buttonText).toBe("Open Event");
  });

  it("DL-4: resolves LinkService channel deep link (channels_ and channel_)", () => {
    const resPlural = resolveDeepLink("channels_9876", BASE_URL);
    expect(resPlural).not.toBeNull();
    expect(resPlural?.targetUrl).toBe("https://app.onton.live/channels/9876");
    expect(resPlural?.buttonText).toBe("View Channel");

    const resSingular = resolveDeepLink("channel_9876", BASE_URL);
    expect(resSingular?.targetUrl).toBe("https://app.onton.live/channels/9876");
  });

  it("DL-5: resolves LinkService tournament deep link (tournaments_ and tournament_)", () => {
    const resPlural = resolveDeepLink("tournaments_55", BASE_URL);
    expect(resPlural).not.toBeNull();
    expect(resPlural?.targetUrl).toBe("https://app.onton.live/tournaments/55");
    expect(resPlural?.buttonText).toBe("Open Tournament");

    const resSingular = resolveDeepLink("tournament_55", BASE_URL);
    expect(resSingular?.targetUrl).toBe("https://app.onton.live/tournaments/55");
  });

  it("DL-6: resolves LinkService affiliate campaign deep link (campaign-aff-, campaign_, affiliate-)", () => {
    const resAff = resolveDeepLink("campaign-aff-hash999", BASE_URL);
    expect(resAff).not.toBeNull();
    expect(resAff?.targetUrl).toBe("https://app.onton.live/join/hash999");
    expect(resAff?.buttonText).toBe("Join Partner Campaign");

    const resCampaign = resolveDeepLink("campaign_hash999", BASE_URL);
    expect(resCampaign?.targetUrl).toBe("https://app.onton.live/join/hash999");

    const resPrefix = resolveDeepLink("affiliate-hash999", BASE_URL);
    expect(resPrefix?.targetUrl).toBe("https://app.onton.live/join/hash999");
  });

  it("DL-7: resolves onboarding referral link (join_ and join-)", () => {
    const resJoin = resolveDeepLink("join_crypto_hub", BASE_URL);
    expect(resJoin).not.toBeNull();
    expect(resJoin?.targetUrl).toBe("https://app.onton.live/?startapp=join_crypto_hub");
    expect(resJoin?.buttonText).toBe("Join ONTON");
  });

  it("DL-8: returns null for invalid or empty parameters", () => {
    expect(resolveDeepLink("", BASE_URL)).toBeNull();
    expect(resolveDeepLink("unknown-random-gibberish", BASE_URL)).toBeNull();
    // @ts-expect-error test invalid type
    expect(resolveDeepLink(null, BASE_URL)).toBeNull();
  });
});
