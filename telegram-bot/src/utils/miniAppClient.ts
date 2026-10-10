import crypto from "crypto";
import axios, { AxiosResponse } from "axios";
import { logger } from "./logger";

export interface OrganizerLimitsOverride {
  eventsPerDay?: number;
  maxUpcoming?: number | null;
  maxCapacity?: number | null;
}

export interface OrganizerLimitsSummary {
  userId: number;
  tier: "new" | "trusted";
  effectiveLimits: {
    eventsPerDay: number;
    maxUpcoming: number | null;
    maxCapacity: number | null;
  };
  override: OrganizerLimitsOverride | null;
  isAdmin: boolean;
  eventsCreatedLast24Hours: number;
  upcomingEventsCount: number;
  hasPastCheckIns: boolean;
  accountAgeDays: number;
}

/**
 * Resolves the Mini App base URL (internal URL only).
 */
export function getMiniAppBaseUrl(): string {
  if (process.env.INTERNAL_MINI_APP_URL) {
    return process.env.INTERNAL_MINI_APP_URL.replace(/\/$/, "");
  }
  const host = process.env.IP_MINI_APP || "127.0.0.1";
  const port = process.env.MINI_APP_PORT || "3000";
  const protocol = host.startsWith("http://") || host.startsWith("https://") ? "" : "http://";
  return `${protocol}${host}:${port}`;
}

/**
 * Signs a request to the Mini App using HMAC-SHA256.
 * Creates canonical string: `${timestamp}.${method}.${pathname}.${rawBody}`
 */
export async function signedRequest<T>(method: "GET" | "POST" | "PATCH" | "DELETE", pathname: string, body?: any): Promise<AxiosResponse<T>> {
  const secret = process.env.BOT_API_HMAC_SECRET;
  if (!secret) {
    throw new Error("BOT_API_HMAC_SECRET is not set");
  }

  const timestamp = Date.now().toString();
  const rawBody = body ? JSON.stringify(body) : "";
  const canonicalString = `${timestamp}.${method}.${pathname}.${rawBody}`;
  
  const signature = crypto.createHmac("sha256", secret).update(canonicalString).digest("hex");

  const url = `${getMiniAppBaseUrl()}${pathname}`;
  
  return axios.request<T>({
    url,
    method,
    data: rawBody,
    headers: {
      "Content-Type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
    },
    timeout: 5000,
  });
}

/**
 * Fetches organizer limits and tier summary for a user from the Mini App.
 */
export async function fetchUserLimits(userId: number): Promise<OrganizerLimitsSummary | null> {
  const pathname = `/api/v1/user/${userId}/limits`;
  try {
    const res = await signedRequest<OrganizerLimitsSummary>("GET", pathname);
    return res.data;
  } catch (err) {
    logger.error(`fetchUserLimits failed for userId ${userId}:`, err);
    return null;
  }
}

/**
 * Sets or clears organizer limits override for a user in the Mini App.
 */
export async function setUserLimitsOverride(
  userId: number,
  limitsOverride: OrganizerLimitsOverride | null
): Promise<{ success: boolean; summary?: OrganizerLimitsSummary; error?: string }> {
  const pathname = `/api/v1/user/${userId}/limits`;
  const body = { limits_override: limitsOverride };
  try {
    const res = await signedRequest<{ success: boolean; summary?: OrganizerLimitsSummary }>("PATCH", pathname, body);
    return { success: true, summary: res.data?.summary };
  } catch (err: unknown) {
    logger.error(`setUserLimitsOverride failed for userId ${userId}:`, err);
    const errorMessage =
      axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : "Failed to update limits";
    return { success: false, error: errorMessage };
  }
}

/**
 * Records an organizer payout in the Mini App.
 */
export async function recordOrganizerPayout(input: {
  event_uuid: string;
  tx_hash: string;
  amount: string;
  organizer_wallet: string;
  telegram_user_id: number;
}): Promise<{ success: boolean; error?: string; status?: number }> {
  const pathname = "/api/v1/payout";
  try {
    await signedRequest("POST", pathname, input);
    return { success: true };
  } catch (err: unknown) {
    logger.error(`recordOrganizerPayout failed for event ${input.event_uuid}:`, err);
    let errorMessage = "Failed to record payout";
    let status: number | undefined;
    if (axios.isAxiosError(err)) {
      errorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      status = err.response?.status;
    }
    return { success: false, error: errorMessage, status };
  }
}
