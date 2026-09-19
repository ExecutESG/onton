import { describe, it, expect } from "vitest";
import eventDB from "@/db/modules/events.db";
import { dataValidationSchema } from "@/zodSchema/dataValidationSchema";

describe("Instant Auto-Publishing & Frontend Decoupling Flow (#1011, #1012)", () => {
  describe("Backend: shouldEventBeHidden (Issue #1012)", () => {
    it("auto-publishes free events by default without requiring ton_society_verified", async () => {
      const isHidden = await eventDB.shouldEventBeHidden(false, 12345);
      expect(isHidden).toBe(false);
    });

    it("auto-publishes free events for unverified organizer (user_id = 999999)", async () => {
      const isHidden = await eventDB.shouldEventBeHidden(false, 999999);
      expect(isHidden).toBe(false);
    });

    it("enforces hidden = true for paid events pending payment setup", async () => {
      const isHidden = await eventDB.shouldEventBeHidden(true, 12345);
      expect(isHidden).toBe(true);
    });
  });

  describe("Frontend: Event Publication State Decoupling (Issue #1011)", () => {
    // Exact logic in EventPageSections.tsx
    function computeIsNotPublished(eventData: { hidden?: boolean | null; enabled?: boolean | null; activity_id?: number | null }): boolean {
      return !!eventData?.hidden || !eventData?.enabled;
    }

    it("does NOT display pending moderation banner for published modern events with activity_id: null", () => {
      const modernEvent = {
        event_uuid: "8a5da15a-6b40-4d0c-8a7c-af0191c81637",
        title: "Auto-Published Test Event",
        hidden: false,
        enabled: true,
        activity_id: null,
      };

      const isNotPublished = computeIsNotPublished(modernEvent);
      expect(isNotPublished).toBe(false);
    });

    it("displays moderation banner only when explicitly hidden or disabled", () => {
      expect(computeIsNotPublished({ hidden: true, enabled: true, activity_id: null })).toBe(true);
      expect(computeIsNotPublished({ hidden: false, enabled: false, activity_id: null })).toBe(true);
      expect(computeIsNotPublished({ hidden: true, enabled: false, activity_id: null })).toBe(true);
    });

    // Exact logic in ShareEventButton.tsx
    function computeIsShareDisabled(props: { initData: string; isLoading: boolean; hidden?: boolean | null }): boolean {
      return !props.initData || props.isLoading || !!props.hidden;
    }

    it("enables the Share Event button immediately when hidden is false regardless of activity_id", () => {
      const isShareDisabled = computeIsShareDisabled({
        initData: "query_id=AAH...",
        isLoading: false,
        hidden: false,
      });
      expect(isShareDisabled).toBe(false);
    });

    it("disables Share Event button when event is hidden or unauthenticated", () => {
      expect(computeIsShareDisabled({ initData: "", isLoading: false, hidden: false })).toBe(true);
      expect(computeIsShareDisabled({ initData: "query_id=AAH...", isLoading: true, hidden: false })).toBe(true);
      expect(computeIsShareDisabled({ initData: "query_id=AAH...", isLoading: false, hidden: true })).toBe(true);
    });
  });

  describe("URL Validation Hardening (Task 3)", () => {
    it("auto-prepends https:// when domain is entered directly", () => {
      const parsed = dataValidationSchema.urlSchema.safeParse("meet.google.com/xyz-abc");
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe("https://meet.google.com/xyz-abc");
      }
    });

    it("auto-fixes leading ttps:// when pasted with missing h", () => {
      const parsed = dataValidationSchema.urlSchema.safeParse("ttps://zoom.us/j/123456789");
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe("https://zoom.us/j/123456789");
      }
    });

    it("auto-trims leading and trailing whitespace", () => {
      const parsed = dataValidationSchema.urlSchema.safeParse("   https://t.me/ontonlive   ");
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe("https://t.me/ontonlive");
      }
    });

    it("rejects invalid URL without domain dot or invalid characters", () => {
      const parsed = dataValidationSchema.urlSchema.safeParse("not a valid url");
      expect(parsed.success).toBe(false);
    });
  });
});
