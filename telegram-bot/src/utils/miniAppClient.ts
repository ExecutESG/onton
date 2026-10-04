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
 * Resolves the Mini App base URL.
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
 * Generates HMAC signature and authentication headers for Mini App requests.
 */
export function getMiniAppHeaders(body?: unknown): Record<string, string> {
  const secret =
    process.env.BOT_API_HMAC_SECRET ||
    process.env.ONTON_API_SECRET ||
    process.env.BOT_TOKEN ||
    "";
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${
    typeof body === "object" && body !== null ? JSON.stringify(body) : body ?? ""
  }`;
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(payload).digest("hex")
    : "";

  return {
    "Content-Type": "application/json",
    "x-api-key": secret,
    "x-signature": signature,
    "x-timestamp": timestamp,
  };
}

/**
 * Fetches organizer limits and tier summary for a user from the Mini App.
 */
export async function fetchUserLimits(userId: number): Promise<OrganizerLimitsSummary | null> {
  const url = `${getMiniAppBaseUrl()}/api/v1/user/${userId}/limits`;
  try {
    const res: AxiosResponse<OrganizerLimitsSummary> = await axios.get(url, {
      headers: getMiniAppHeaders(),
      timeout: 5000,
    });
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
  const url = `${getMiniAppBaseUrl()}/api/v1/user/${userId}/limits`;
  const body = { limits_override: limitsOverride };
  try {
    const res = await axios.patch(url, body, {
      headers: getMiniAppHeaders(body),
      timeout: 5000,
    });
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
