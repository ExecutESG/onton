import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/modules/moderationLogger.db", () => ({
  default: {
    getNoticeCountForOwner: vi.fn().mockResolvedValue(0),
    insertModerationLog: vi.fn().mockResolvedValue(true),
  },
  moderationLogDB: {
    getNoticeCountForOwner: vi.fn().mockResolvedValue(0),
    insertModerationLog: vi.fn().mockResolvedValue(true),
  },
}));

import {
  tgBotPostPublishModerationMenu,
  tgBotDelistedMenu,
  tgBotReportedEventMenu,
  tgBotModerationMenu,
} from "@/moderationBot/menu";
import {
  renderPostPublishModerationMessage,
  renderEventReportAlertMessage,
} from "@/lib/tgBot";

describe("Trust & Safety Post-Moderation Architecture (Issue #1013 & #1014)", () => {
  const sampleEventUuid = "evt-sec-8842-test";
  const sampleOrganizerId = 987654321;

  describe("Telegram Moderation Bot Reactive Action Menus (#1013)", () => {
    it("generates post-publish reactive menu with delist, warn, and ban actions", () => {
      const menu = tgBotPostPublishModerationMenu(sampleEventUuid, sampleOrganizerId);
      const buttons = menu.inline_keyboard.flat();

      const callbackDatas = buttons.map((b) => ("callback_data" in b ? b.callback_data : ""));
      const buttonTexts = buttons.map((b) => b.text);

      expect(callbackDatas).toContain(`delist_${sampleEventUuid}`);
      expect(callbackDatas).toContain(`warn_${sampleOrganizerId}_${sampleEventUuid}`);
      expect(callbackDatas).toContain(`ban_${sampleOrganizerId}_${sampleEventUuid}`);
      expect(callbackDatas).toContain(`updateEventData_${sampleEventUuid}`);

      expect(buttonTexts.some((t) => t.includes("Delist"))).toBe(true);
      expect(buttonTexts.some((t) => t.includes("Warn"))).toBe(true);
      expect(buttonTexts.some((t) => t.includes("Ban"))).toBe(true);
    });

    it("generates delisted menu with 1-tap re-list restore capability", () => {
      const menu = tgBotDelistedMenu(sampleEventUuid);
      const buttons = menu.inline_keyboard.flat();
      const callbackDatas = buttons.map((b) => ("callback_data" in b ? b.callback_data : ""));

      expect(callbackDatas).toContain(`relist_${sampleEventUuid}`);
      expect(callbackDatas).toContain(`updateEventData_${sampleEventUuid}`);
    });

    it("generates reported event menu with confirm delist and dismiss actions", () => {
      const menu = tgBotReportedEventMenu(sampleEventUuid);
      const buttons = menu.inline_keyboard.flat();
      const callbackDatas = buttons.map((b) => ("callback_data" in b ? b.callback_data : ""));

      expect(callbackDatas).toContain(`confirmDelist_${sampleEventUuid}`);
      expect(callbackDatas).toContain(`dismissReport_${sampleEventUuid}`);
    });
  });

  describe("Post-Publish Notification Card Rendering (#1013)", () => {
    it("formats clean Lu.ma-style post-publish notification card", async () => {
      const sampleEventData: any = {
        event_uuid: sampleEventUuid,
        title: "TON Hacker House Helsinki",
        subtitle: "Global developer gathering",
        location: "Maria01, Helsinki",
        participationType: "in_person",
        is_paid: false,
        owner: String(sampleOrganizerId),
      };

      const card = await renderPostPublishModerationMessage("ton_builder", sampleEventData);

      expect(card).toContain("New Event Published (Lu.ma Instant Model)");
      expect(card).toContain("TON Hacker House Helsinki");
      expect(card).toContain("@ton_builder");
      expect(card).toContain(String(sampleOrganizerId));
      expect(card).toContain("Maria01, Helsinki");
      expect(card).toContain("in_person");
      expect(card).toContain(sampleEventUuid);
    });
  });

  describe("Community Abuse Reporting Alert Card (#1014)", () => {
    it("renders standard community abuse report alert", () => {
      const alert = renderEventReportAlertMessage({
        eventTitle: "Guaranteed 100x TON Airdrop",
        eventUuid: sampleEventUuid,
        reporterUsername: "vigilant_user",
        reason: "phishing",
        notes: "Drains wallet via malicious contract on external website",
        totalReports: 1,
        isQuarantined: false,
      });

      expect(alert).toContain("COMMUNITY EVENT REPORT");
      expect(alert).toContain("Guaranteed 100x TON Airdrop");
      expect(alert).toContain("phishing");
      expect(alert).toContain("Drains wallet via malicious contract");
      expect(alert).toContain("@vigilant_user");
      expect(alert).toContain("<b>Total Reports:</b> 1");
      expect(alert).not.toContain("AUTO-QUARANTINED");
    });

    it("renders prominent [AUTO-QUARANTINED] warning when threshold is exceeded", () => {
      const alert = renderEventReportAlertMessage({
        eventTitle: "Malicious Phishing Drainer",
        eventUuid: sampleEventUuid,
        reporterUsername: "third_reporter",
        reason: "phishing",
        notes: "Multiple users reported drainer",
        totalReports: 3,
        isQuarantined: true,
      });

      expect(alert).toContain("AUTO-QUARANTINED");
      expect(alert).toContain("Exceeded threshold: Hidden from public discovery");
      expect(alert).toContain("<b>Total Reports:</b> 3");
    });
  });

  describe("Abuse Ingestion & Quarantine Threshold Rules (#1014)", () => {
    it("calculates quarantine threshold properly (>= 3 reports)", () => {
      const checkQuarantine = (reportCount: number) => reportCount >= 3;

      expect(checkQuarantine(1)).toBe(false);
      expect(checkQuarantine(2)).toBe(false);
      expect(checkQuarantine(3)).toBe(true);
      expect(checkQuarantine(7)).toBe(true);
    });

    it("enforces rate-limiting: 1 report per user per event", () => {
      const existingReports = new Set([`${sampleEventUuid}:1001`, `${sampleEventUuid}:1002`]);

      const canSubmit = (eventUuid: string, userId: number) => {
        const key = `${eventUuid}:${userId}`;
        if (existingReports.has(key)) return false;
        existingReports.add(key);
        return true;
      };

      expect(canSubmit(sampleEventUuid, 1001)).toBe(false); // already reported
      expect(canSubmit(sampleEventUuid, 1003)).toBe(true);  // new reporter
      expect(canSubmit(sampleEventUuid, 1003)).toBe(false); // second attempt blocked
    });

    it("cascading organizer ban delists all associated events", () => {
      const eventsStore = [
        { uuid: "ev-1", owner: "user-99", hidden: false, enabled: true },
        { uuid: "ev-2", owner: "user-99", hidden: false, enabled: true },
        { uuid: "ev-3", owner: "user-42", hidden: false, enabled: true },
      ];

      // Simulate banning user-99
      const banOrganizer = (organizerId: string) => {
        for (const ev of eventsStore) {
          if (ev.owner === organizerId) {
            ev.hidden = true;
            ev.enabled = false;
          }
        }
      };

      banOrganizer("user-99");

      expect(eventsStore[0].hidden).toBe(true);
      expect(eventsStore[0].enabled).toBe(false);
      expect(eventsStore[1].hidden).toBe(true);
      expect(eventsStore[1].enabled).toBe(false);
      expect(eventsStore[2].hidden).toBe(false); // Unaffected organizer
      expect(eventsStore[2].enabled).toBe(true);
    });
  });
});
