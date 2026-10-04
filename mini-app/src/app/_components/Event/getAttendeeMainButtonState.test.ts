import { describe, it, expect } from "vitest";
import { getAttendeeMainButtonState, GetAttendeeMainButtonStateParams } from "./getAttendeeMainButtonState";

describe("getAttendeeMainButtonState", () => {
  const defaultParams: GetAttendeeMainButtonStateParams = {
    isPaid: false,
    isRegistered: false,
    isNotEnded: true,
    isStarted: true,
    isOnlineEvent: false,
    isCheckedIn: false,
    hasEnteredPassword: true,
    hasSbt: false,
    userCompletedTasks: false,
    registrantUuid: undefined,
    tiers: [],
    paymentDetails: undefined,
  };

  it("free approved in-person before start -> QR button enabled", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isRegistered: true,
      userCompletedTasks: true,
      isStarted: false,
      registrantUuid: "uuid-123",
    });
    expect(result).toEqual({ type: "show_qr" });
  });

  it("free approved in-person running -> QR button", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isRegistered: true,
      userCompletedTasks: true,
      isStarted: true,
      registrantUuid: "uuid-123",
    });
    expect(result).toEqual({ type: "show_qr" });
  });

  it("pending/rejected/waitlisted -> none (fallback to not_started / none)", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isRegistered: false,
      userCompletedTasks: false, // User hasn't completed tasks (not approved/checkedin)
      isStarted: true,
      registrantUuid: "uuid-123",
    });
    expect(result).toEqual({ type: "none" }); // since isStarted=true, it falls through to none
  });

  it("online event -> not_started / none (no QR)", () => {
    // Before start online event
    const resultBeforeStart = getAttendeeMainButtonState({
      ...defaultParams,
      isRegistered: true,
      userCompletedTasks: true,
      isStarted: false,
      isOnlineEvent: true,
      registrantUuid: "uuid-123",
    });
    expect(resultBeforeStart).toEqual({ type: "not_started" });

    // Running online event
    const resultRunning = getAttendeeMainButtonState({
      ...defaultParams,
      isRegistered: true,
      userCompletedTasks: true,
      isStarted: true,
      isOnlineEvent: true,
      registrantUuid: "uuid-123",
    });
    expect(resultRunning).toEqual({ type: "none" });
  });

  it("checked-in -> 'Checked In'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isCheckedIn: true,
    });
    expect(result).toEqual({ type: "checked_in" });
  });

  it("ended -> 'Event Has Ended'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isNotEnded: false,
    });
    expect(result).toEqual({ type: "ended" });
  });

  it("paid w/ ticket -> 'View Ticket Pass'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isPaid: true,
      isRegistered: true,
    });
    expect(result).toEqual({ type: "view_ticket_pass" });
  });
});
