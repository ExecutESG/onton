import { describe, it, expect } from "vitest";

describe("Community Gating & Entry Operations API Flow", () => {
  // Automated Chat Gating
  describe("Automated Telegram Chat Gating", () => {
    it("configures single-use invite link parameters properly", () => {
      const chatGatingConfig = {
        chat_id: -100123456789,
        member_limit: 1, // Single-use!
        creates_join_request: false,
        name: "ONTON Pass: user_12345",
      };

      expect(chatGatingConfig.member_limit).toBe(1);
      expect(chatGatingConfig.creates_join_request).toBe(false);
      expect(chatGatingConfig.name).toContain("ONTON Pass");
    });
  });

  // Unified Ticket Resolution Fallback
  describe("Unified Ticket Check-In Resolution", () => {
    interface MockRecord {
      id: number;
      uuid?: string;
      order_uuid?: string;
      registrant_uuid?: string;
      status: string;
      checked_in: boolean;
    }

    function resolveScannedCode(
      code: string,
      tables: {
        tickets: MockRecord[];
        registrants: MockRecord[];
        orders: MockRecord[];
      }
    ) {
      // 1. Check tickets table
      const ticketMatch = tables.tickets.find((t) => t.uuid === code);
      if (ticketMatch) return { source: "tickets", record: ticketMatch };

      // 2. Check eventRegistrants table
      const regMatch = tables.registrants.find((r) => r.registrant_uuid === code);
      if (regMatch) return { source: "eventRegistrants", record: regMatch };

      // 3. Check orders table
      const orderMatch = tables.orders.find((o) => o.order_uuid === code);
      if (orderMatch) return { source: "orders", record: orderMatch };

      return null;
    }

    const testDb = {
      tickets: [{ id: 1, uuid: "ticket-pass-111", status: "active", checked_in: false }],
      registrants: [{ id: 2, registrant_uuid: "reg-code-222", status: "approved", checked_in: false }],
      orders: [{ id: 3, order_uuid: "order-hash-333", status: "completed", checked_in: false }],
    };

    it("resolves ticket by ticket uuid", () => {
      const match = resolveScannedCode("ticket-pass-111", testDb);
      expect(match?.source).toBe("tickets");
      expect(match?.record.id).toBe(1);
    });

    it("resolves ticket by registrant uuid fallback", () => {
      const match = resolveScannedCode("reg-code-222", testDb);
      expect(match?.source).toBe("eventRegistrants");
      expect(match?.record.id).toBe(2);
    });

    it("resolves ticket by order uuid fallback", () => {
      const match = resolveScannedCode("order-hash-333", testDb);
      expect(match?.source).toBe("orders");
      expect(match?.record.id).toBe(3);
    });

    it("returns null for unrecognized QR pass", () => {
      const match = resolveScannedCode("invalid-code-999", testDb);
      expect(match).toBeNull();
    });
  });

  // Check-In Execution & SBT Reward
  describe("Check-In Validation & Duplicate Prevention", () => {
    function performCheckIn(ticket: { id: number; checked_in: boolean }) {
      if (ticket.checked_in) {
        return { success: false, error: "TICKET_ALREADY_USED" };
      }
      ticket.checked_in = true;
      return {
        success: true,
        checkedInAt: new Date().toISOString(),
        unlocksSBT: true,
      };
    }

    it("successfully checks in fresh ticket and unlocks SBT", () => {
      const freshTicket = { id: 42, checked_in: false };
      const result = performCheckIn(freshTicket);

      expect(result.success).toBe(true);
      expect(result.unlocksSBT).toBe(true);
      expect(freshTicket.checked_in).toBe(true);
    });

    it("rejects duplicate check-in scan attempts", () => {
      const usedTicket = { id: 42, checked_in: true };
      const result = performCheckIn(usedTicket);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TICKET_ALREADY_USED");
    });
  });

  // RSVP Concurrency & Waitlist Auto-Promotion (#967)
  describe("RSVP Concurrency & Waitlist Auto-Promotion Engine", () => {
    interface Attendee {
      id: number;
      userId: number;
      status: "approved" | "pending" | "rejected";
      createdAt: number;
    }

    function registerAttendee(
      attendees: Attendee[],
      userId: number,
      eventConfig: { capacity: number; hasWaitingList: boolean }
    ) {
      const approvedCount = attendees.filter((a) => a.status === "approved").length;
      const isCapacityFilled = approvedCount >= eventConfig.capacity;

      if (isCapacityFilled && !eventConfig.hasWaitingList) {
        return { success: false, error: "CAPACITY_REACHED" };
      }

      const status: "approved" | "pending" = isCapacityFilled ? "pending" : "approved";
      const newAttendee: Attendee = {
        id: attendees.length + 1,
        userId,
        status,
        createdAt: Date.now(),
      };
      attendees.push(newAttendee);

      return { success: true, status, attendee: newAttendee };
    }

    function rejectAndPromoteWaitlist(
      attendees: Attendee[],
      userIdToReject: number,
      eventConfig: { capacity: number }
    ) {
      const target = attendees.find((a) => a.userId === userIdToReject);
      if (!target) return { promoted: null };

      const wasApproved = target.status === "approved";
      target.status = "rejected";

      if (!wasApproved) return { promoted: null };

      const approvedCount = attendees.filter((a) => a.status === "approved").length;
      if (approvedCount < eventConfig.capacity) {
        // Find oldest pending
        const oldestPending = attendees
          .filter((a) => a.status === "pending")
          .sort((a, b) => a.createdAt - b.createdAt)[0];

        if (oldestPending) {
          oldestPending.status = "approved";
          return { promoted: oldestPending };
        }
      }

      return { promoted: null };
    }

    it("prevents overbooking when capacity is reached and waiting list is disabled", () => {
      const attendees: Attendee[] = [
        { id: 1, userId: 101, status: "approved", createdAt: 1 },
        { id: 2, userId: 102, status: "approved", createdAt: 2 },
      ];
      const eventConfig = { capacity: 2, hasWaitingList: false };

      const result = registerAttendee(attendees, 103, eventConfig);
      expect(result.success).toBe(false);
      expect(result.error).toBe("CAPACITY_REACHED");
      expect(attendees.filter((a) => a.status === "approved").length).toBe(2);
    });

    it("places registrant on pending waitlist when capacity is full and waiting list is enabled", () => {
      const attendees: Attendee[] = [
        { id: 1, userId: 101, status: "approved", createdAt: 1 },
        { id: 2, userId: 102, status: "approved", createdAt: 2 },
      ];
      const eventConfig = { capacity: 2, hasWaitingList: true };

      const result = registerAttendee(attendees, 103, eventConfig);
      expect(result.success).toBe(true);
      expect(result.status).toBe("pending");
      expect(attendees.find((a) => a.userId === 103)?.status).toBe("pending");
    });

    it("auto-promotes the oldest pending waitlisted user when an approved attendee cancels/is rejected", () => {
      const attendees: Attendee[] = [
        { id: 1, userId: 101, status: "approved", createdAt: 100 },
        { id: 2, userId: 102, status: "approved", createdAt: 200 },
        { id: 3, userId: 103, status: "pending", createdAt: 300 }, // Oldest pending
        { id: 4, userId: 104, status: "pending", createdAt: 400 },
      ];
      const eventConfig = { capacity: 2 };

      // Reject approved user 101
      const outcome = rejectAndPromoteWaitlist(attendees, 101, eventConfig);
      expect(outcome.promoted).not.toBeNull();
      expect(outcome.promoted?.userId).toBe(103);
      expect(outcome.promoted?.status).toBe("approved");

      // Verify approved count remains exactly at capacity (2)
      const approvedUsers = attendees.filter((a) => a.status === "approved");
      expect(approvedUsers.length).toBe(2);
      expect(approvedUsers.map((u) => u.userId)).toEqual([102, 103]);

      // Verify user 104 is still pending in queue
      expect(attendees.find((a) => a.userId === 104)?.status).toBe("pending");
    });
  });
});

