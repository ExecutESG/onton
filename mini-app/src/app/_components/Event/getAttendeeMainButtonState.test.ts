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

  it("free event open RSVP unregistered -> 'register' with label 'Register'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      hasRegistration: true,
      hasApproval: false,
      user: { user_id: 123 },
    });
    expect(result).toEqual({ type: "register", label: "Register" });
  });

  it("free event approval required unregistered -> 'register' with label 'Request to Join'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      hasRegistration: true,
      hasApproval: true,
      user: { user_id: 123 },
    });
    expect(result).toEqual({ type: "register", label: "Request to Join" });
  });

  it("free event capacity filled with waitlist -> 'register' with label 'Join Waitlist'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      hasRegistration: true,
      capacityFilled: true,
      hasWaitingList: true,
      user: { user_id: 123 },
    });
    expect(result).toEqual({ type: "register", label: "Join Waitlist" });
  });

  it("free event capacity filled without waitlist -> 'capacity_filled'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      hasRegistration: true,
      capacityFilled: true,
      hasWaitingList: false,
      user: { user_id: 123 },
    });
    expect(result).toEqual({ type: "capacity_filled" });
  });

  it("free event unauthenticated user -> 'login_required'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      hasRegistration: true,
      user: null,
    });
    expect(result).toEqual({ type: "login_required" });
  });

  it("registrant status pending -> 'pending'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      registrantStatus: "pending",
    });
    expect(result).toEqual({ type: "pending" });
  });

  it("registrant status rejected -> 'rejected'", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      registrantStatus: "rejected",
    });
    expect(result).toEqual({ type: "rejected" });
  });

  it("checked-in attendee can claim SBT even after event has ended", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isNotEnded: false,
      isCheckedIn: true,
      hasSbt: true,
      hasEnteredPassword: true,
    });
    expect(result).toEqual({ type: "claim_sbt" });
  });

  it("checked-in attendee shows 'checked_in' even after event has ended", () => {
    const result = getAttendeeMainButtonState({
      ...defaultParams,
      isNotEnded: false,
      isCheckedIn: true,
      hasSbt: false,
      hasEnteredPassword: true,
    });
    expect(result).toEqual({ type: "checked_in" });
  });
});
