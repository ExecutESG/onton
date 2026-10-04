export type MainButtonState =
  | { type: "view_ticket_pass" }
  | { type: "checkout"; label: string }
  | { type: "register"; label: string }
  | { type: "login_required" }
  | { type: "pending" }
  | { type: "rejected" }
  | { type: "capacity_filled" }
  | { type: "claim_sbt" }
  | { type: "checked_in" }
  | { type: "show_qr" }
  | { type: "not_started" }
  | { type: "ended" }
  | { type: "none" };

export interface GetAttendeeMainButtonStateParams {
  isPaid: boolean;
  isRegistered: boolean;
  isNotEnded: boolean;
  isStarted: boolean;
  isOnlineEvent: boolean;
  isCheckedIn: boolean;
  hasEnteredPassword: boolean;
  hasSbt: boolean;
  userCompletedTasks: boolean;
  registrantUuid: string | undefined;
  tiers: Array<{ price: number | string | null }>;
  paymentDetails?: { price?: number | null; token?: { symbol?: string | null } | null };
  hasRegistration?: boolean;
  hasApproval?: boolean;
  capacityFilled?: boolean;
  hasWaitingList?: boolean;
  registrantStatus?: string;
  user?: { user_id?: number | string } | null;
}

export function getAttendeeMainButtonState(params: GetAttendeeMainButtonStateParams): MainButtonState {
  const {
    isPaid,
    isRegistered,
    isNotEnded,
    isStarted,
    isOnlineEvent,
    isCheckedIn,
    hasEnteredPassword,
    hasSbt,
    userCompletedTasks,
    registrantUuid,
    tiers,
    paymentDetails,
    hasRegistration,
    hasApproval,
    capacityFilled,
    hasWaitingList,
    registrantStatus,
    user,
  } = params;

  // Checked in attendee: directly claim or view attendance SBT badge (even after event has ended)
  if (isCheckedIn && hasEnteredPassword) {
    if (hasSbt) {
      return { type: "claim_sbt" };
    }
    return { type: "checked_in" };
  }

  // Ended
  if (!isNotEnded) {
    return { type: "ended" };
  }

  // Paid event: user has ticket → view ticket pass
  if (isPaid && isRegistered && isNotEnded) {
    return { type: "view_ticket_pass" };
  }

  // Paid or tiered event: user hasn't bought ticket yet → checkout
  if (isPaid && !isRegistered && isNotEnded) {
    let label = "Get Tickets";
    if (tiers.length > 0) {
      const prices = tiers.map((t) => Number(t.price || 0));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      if (maxPrice === 0) {
        label = "Get Free Ticket";
      } else if (minPrice === 0) {
        label = "Get Tickets";
      } else if (minPrice === maxPrice) {
        label = `Buy Ticket — ⭐ ${minPrice}`;
      } else {
        label = `Get Tickets — From ⭐ ${minPrice}`;
      }
    } else {
      const price = Number(paymentDetails?.price ?? 0);
      const symbol = paymentDetails?.token?.symbol ?? "TON";
      label = price > 0 ? `Buy Ticket — ${price} ${symbol}` : "Get Free Ticket";
    }
    return { type: "checkout", label };
  }

  // Approved attendee before check-in: show QR pass to check in
  if (userCompletedTasks && hasEnteredPassword) {
    if (!isOnlineEvent && isNotEnded && registrantUuid) {
      return { type: "show_qr" };
    }
  }

  // Registrant pending / rejected
  if (registrantStatus === "pending") {
    return { type: "pending" };
  }
  if (registrantStatus === "rejected") {
    return { type: "rejected" };
  }

  // Free event with registration: user not registered yet
  if (!isPaid && hasRegistration && !isRegistered) {
    if (capacityFilled && !hasWaitingList) {
      return { type: "capacity_filled" };
    }
    if (user === null) {
      return { type: "login_required" };
    }
    if (capacityFilled && hasWaitingList) {
      return { type: "register", label: "Join Waitlist" };
    }
    if (hasApproval) {
      return { type: "register", label: "Request to Join" };
    }
    return { type: "register", label: "Register" };
  }

  if (!isStarted && isNotEnded) {
    return { type: "not_started" };
  }

  return { type: "none" };
}
