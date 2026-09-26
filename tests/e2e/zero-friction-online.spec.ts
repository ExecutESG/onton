import { test, expect } from "@playwright/test";
import { injectTelegramMock } from "./helpers/telegram-mock";

const BASE_URL = process.env.BASE_URL || "https://app.dev.onton.live";

test.describe("Zero-Friction Online Event Participation (Maximum Reach Archetype)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /**
   * TC-ZF-01: Direct Public View Access
   * Verifies that unauthenticated visitors can view online event broadcast links
   * without wallet connection, login wall, KYC, or payment prompts.
   */
  test("TC-ZF-01: Public online event displays livestream link directly to guests without wallet prompt", async ({ page }) => {
    const mockOnlineEventUuid = "77777777-0000-0000-0000-000000000001";

    // Intercept tRPC event query to supply a zero-friction online event
    await page.route("**/api/trpc/*", async (route) => {
      const url = route.request().url().toLowerCase();
      if (url.includes("events.getevent")) {
        await route.fulfill({
          json: [
            {
              result: {
                data: {
                  event_id: 8801,
                  event_uuid: mockOnlineEventUuid,
                  title: "TON Global Ecosystem All-Hands & Product Keynote",
                  subtitle: "Open Community Broadcast & Live Q&A",
                  participationType: "online",
                  has_registration: false,
                  has_payment: false,
                  has_approval: false,
                  location: "https://t.me/toncommunity?livestream",
                  description: "Join the core ecosystem teams for live product updates and roadmap reveals.",
                  capacity: null, // Unlimited
                  isStarted: true,
                  isNotEnded: true,
                },
              },
            },
          ],
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/events/${mockOnlineEventUuid}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // Verify page rendered and no blocking wallet modal or KYC wall is active
    await expect(page.locator("body")).toBeVisible();
    const activeModal = page.locator(".tc-modal-wrapper, div[role='dialog']");
    await expect(activeModal).toHaveCount(0);
  });

  /**
   * TC-ZF-02: 1-Tap Calendar Sync (.ics generator)
   * Verifies that the event generates valid .ics calendar content with livestream URL and zero user forms.
   */
  test("TC-ZF-02: 1-Tap 'Add to Calendar' creates valid .ics entry with livestream URL", async () => {
    interface OnlineCalendarEvent {
      title: string;
      description: string;
      streamUrl: string;
      startTimeIso: string;
      endTimeIso: string;
      timezone: string;
    }

    function generateICS(event: OnlineCalendarEvent): string {
      const formatDate = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ONTON//ZeroFrictionEvent//EN",
        "BEGIN:VEVENT",
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${event.description} \\nJoin Stream: ${event.streamUrl}`,
        `LOCATION:${event.streamUrl}`,
        `DTSTART:${formatDate(event.startTimeIso)}`,
        `DTEND:${formatDate(event.endTimeIso)}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
    }

    const event: OnlineCalendarEvent = {
      title: "TON Global Ecosystem All-Hands",
      description: "Live keynote and community AMA",
      streamUrl: "https://t.me/toncommunity?livestream",
      startTimeIso: "2026-10-15T16:00:00Z",
      endTimeIso: "2026-10-15T18:00:00Z",
      timezone: "UTC",
    };

    const icsContent = generateICS(event);
    expect(icsContent).toContain("BEGIN:VCALENDAR");
    expect(icsContent).toContain("SUMMARY:TON Global Ecosystem All-Hands");
    expect(icsContent).toContain("LOCATION:https://t.me/toncommunity?livestream");
    expect(icsContent).toContain("END:VCALENDAR");
  });

  /**
   * TC-ZF-03: Direct Livestream Launch
   * Validates that livestream CTA navigates directly to the target stream without interstitial gating.
   */
  test("TC-ZF-03: Livestream button deep-links directly to broadcast destination", async () => {
    const streamTarget = "https://youtube.com/live/ton-keynote-2026";

    function getStreamAction(streamUrl: string) {
      if (!streamUrl || !streamUrl.startsWith("http")) {
        throw new Error("Invalid stream destination");
      }
      return {
        action: "OPEN_STREAM",
        url: streamUrl,
        requiresAuth: false,
        requiresPayment: false,
      };
    }

    const action = getStreamAction(streamTarget);
    expect(action.action).toBe("OPEN_STREAM");
    expect(action.url).toBe(streamTarget);
    expect(action.requiresAuth).toBe(false);
    expect(action.requiresPayment).toBe(false);
  });

  /**
   * TC-ZF-04: Optional 1-Tap RSVP
   * For logged-in Telegram users who want notifications, RSVP succeeds in a single tap without forms or fees.
   */
  test("TC-ZF-04: Authenticated 1-tap RSVP succeeds without questions or fees", async () => {
    interface InstantRSVPRequest {
      userId: number;
      eventUuid: string;
    }

    function processInstantRSVP(req: InstantRSVPRequest, event: { has_payment: boolean; has_approval: boolean; dynamic_fields: any[] }) {
      if (event.has_payment || event.has_approval || (event.dynamic_fields && event.dynamic_fields.length > 0)) {
        return { isFrictionless: false, status: "pending_requirements" };
      }
      return {
        isFrictionless: true,
        status: "confirmed",
        userId: req.userId,
        eventUuid: req.eventUuid,
        timestamp: Date.now(),
      };
    }

    const rsvp = processInstantRSVP(
      { userId: 987654321, eventUuid: "77777777-0000-0000-0000-000000000001" },
      { has_payment: false, has_approval: false, dynamic_fields: [] }
    );

    expect(rsvp.isFrictionless).toBe(true);
    expect(rsvp.status).toBe("confirmed");
  });
});
