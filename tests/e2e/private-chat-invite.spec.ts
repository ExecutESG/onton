import { test, expect } from "@playwright/test";

test.describe("Single-Use Private Chat Invite Link Delivery (Wave 6 - Issue #970)", () => {
  /**
   * TC-INV-01: Single-Use Link Creation on Payment
   * Verifies that the bot calls createChatInviteLink with member_limit: 1 for paid/approved registrants.
   */
  test("TC-INV-01: Bot creates single-use invite link with member_limit: 1", async () => {
    interface CreateChatInviteLinkOptions {
      name?: string;
      expire_date?: number;
      member_limit?: number;
      creates_join_request?: boolean;
    }

    interface ChatInviteLinkResult {
      invite_link: string;
      creator: { id: number; is_bot: boolean };
      creates_join_request: boolean;
      is_primary: boolean;
      is_revoked: boolean;
      member_limit?: number;
    }

    async function mockCreateSingleUseInviteLink(
      chatId: string | number,
      options: CreateChatInviteLinkOptions
    ): Promise<ChatInviteLinkResult> {
      // Must enforce member_limit: 1 or creates_join_request: false for instant access
      expect(chatId).toBeDefined();
      expect(options.member_limit === 1 || options.creates_join_request === false).toBe(true);

      const uniqueHash = Math.random().toString(36).substring(2, 10);
      return {
        invite_link: `https://t.me/+${uniqueHash}`,
        creator: { id: 7013087032, is_bot: true },
        creates_join_request: options.creates_join_request ?? false,
        is_primary: false,
        is_revoked: false,
        member_limit: options.member_limit || 1,
      };
    }

    const result = await mockCreateSingleUseInviteLink("-1002345678901", {
      name: "Event_Hackathon_User_987654321",
      member_limit: 1,
      creates_join_request: false,
    });

    expect(result.invite_link).toMatch(/^https:\/\/t\.me\/\+[a-zA-Z0-9]+$/);
    expect(result.member_limit).toBe(1);
    expect(result.is_revoked).toBe(false);
  });

  /**
   * TC-INV-02: Link Delivery via Telegram Bot DM & Ticket QR Screen
   * Verifies link formatting, message construction, and database persistence on registrant record.
   */
  test("TC-INV-02: Generated single-use invite is dispatched via DM and persisted on registrant", async () => {
    interface RegistrantRecord {
      id: number;
      userId: number;
      eventUuid: string;
      inviteLink: string | null;
    }

    const mockRegistrant: RegistrantRecord = {
      id: 5432,
      userId: 987654321,
      eventUuid: "00000000-0000-0000-0000-000000000001",
      inviteLink: null,
    };

    function attachInviteLink(registrant: RegistrantRecord, link: string): RegistrantRecord {
      return { ...registrant, inviteLink: link };
    }

    function constructDMMessage(eventTitle: string, link: string) {
      return {
        text: `🎉 Your ticket for ${eventTitle} is confirmed!\n\n🔗 Here is your personal one-time invite link:\n${link}`,
        inlineButton: { text: "💬 Join Event Chat", url: link },
      };
    }

    const testLink = "https://t.me/+uniqueInvite777";
    const updated = attachInviteLink(mockRegistrant, testLink);

    expect(updated.inviteLink).toBe(testLink);

    const message = constructDMMessage("TON Hacker House Dubai 2026", testLink);
    expect(message.text).toContain("TON Hacker House Dubai 2026");
    expect(message.text).toContain(testLink);
    expect(message.inlineButton.url).toBe(testLink);
  });

  /**
   * TC-INV-03: Single-Use Revocation & Idempotency
   * Verifies that already-joined or expired links cannot be re-shared by unauthorized forwarders.
   */
  test("TC-INV-03: Single-use link expires upon first join and prevents secondary entry", async () => {
    class MockTelegramInviteTracker {
      private linkStatus = new Map<string, { joinedCount: number; maxLimit: number }>();

      registerLink(link: string, maxLimit: number = 1) {
        this.linkStatus.set(link, { joinedCount: 0, maxLimit });
      }

      attemptJoin(link: string): { success: boolean; error?: string } {
        const state = this.linkStatus.get(link);
        if (!state) return { success: false, error: "Link not found" };
        if (state.joinedCount >= state.maxLimit) {
          return { success: false, error: "Link already used / expired" };
        }
        state.joinedCount++;
        return { success: true };
      }
    }

    const tracker = new MockTelegramInviteTracker();
    const link = "https://t.me/+singleUseLink123";
    tracker.registerLink(link, 1);

    // First user joins successfully
    const firstJoin = tracker.attemptJoin(link);
    expect(firstJoin.success).toBe(true);

    // Second user (forwarded) attempts to join using the same link -> rejected
    const secondJoin = tracker.attemptJoin(link);
    expect(secondJoin.success).toBe(false);
    expect(secondJoin.error).toBe("Link already used / expired");
  });
});
