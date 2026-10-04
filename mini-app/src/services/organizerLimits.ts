import { db } from "@/db/db";
import { events, eventRegistrants, tickets, users } from "@/db/schema";
import { OrganizerLimitsOverride } from "@/db/schema/users";
import { getUserCacheKey, selectUserById } from "@/db/modules/users.db";
import { redisTools } from "@/lib/redisTools";
import { TRPCError } from "@trpc/server";
import { and, count, eq, gt, gte, lte } from "drizzle-orm";

export type OrganizerTier = "new" | "trusted";

export interface OrganizerLimits {
  eventsPerDay: number;
  maxUpcoming: number | null; // null = unlimited
  maxCapacity: number | null; // null = unlimited
}

export const NEW_TIER_LIMITS: OrganizerLimits = {
  eventsPerDay: 2,
  maxUpcoming: 5,
  maxCapacity: 500,
};

export const TRUSTED_TIER_LIMITS: OrganizerLimits = {
  eventsPerDay: 20,
  maxUpcoming: null,
  maxCapacity: null,
};

/**
 * Calculates account age in fractional days from created_at timestamp.
 */
export function calculateAccountAgeDays(createdAt: Date | string | null | undefined): number {
  if (!createdAt) return 0;
  const createdMs = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  const diffMs = Date.now() - createdMs;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if the organizer has at least 1 past event with >= 1 checked-in attendee.
 * Inspects both eventRegistrants ('checkedin') and tickets ('USED').
 */
export async function hasPastEventWithCheckedInAttendee(userId: number): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Check eventRegistrants for status = 'checkedin' on past events owned by this user
  const registrantsCheck = await db
    .select({ id: eventRegistrants.id })
    .from(eventRegistrants)
    .innerJoin(events, eq(eventRegistrants.event_uuid, events.event_uuid))
    .where(
      and(
        eq(events.owner, userId),
        lte(events.end_date, nowSec),
        eq(eventRegistrants.status, "checkedin")
      )
    )
    .limit(1)
    .execute();

  if (registrantsCheck.length > 0) return true;

  // 2. Check tickets for status = 'USED' on past events owned by this user
  const ticketsCheck = await db
    .select({ id: tickets.id })
    .from(tickets)
    .innerJoin(events, eq(tickets.event_uuid, events.event_uuid))
    .where(
      and(
        eq(events.owner, userId),
        lte(events.end_date, nowSec),
        eq(tickets.status, "USED")
      )
    )
    .limit(1)
    .execute();

  return ticketsCheck.length > 0;
}

/**
 * Evaluates the organizer tier based on account age and check-in history.
 *
 * Rules:
 * - New tier: account age < 7 days OR no past event with >= 1 checked-in attendee
 * - Trusted tier: >= 1 past event with check-ins OR account age >= 30 days
 */
export function determineOrganizerTier(accountAgeDays: number, hasPastCheckIns: boolean): OrganizerTier {
  if (accountAgeDays >= 30) {
    return "trusted";
  }
  if (accountAgeDays >= 7 && hasPastCheckIns) {
    return "trusted";
  }
  return "new";
}

/**
 * Computes effective limits by applying overrides and admin exemptions.
 * Override wins over the tier. Admins are unlimited.
 */
export function computeEffectiveLimits(
  role: string,
  tier: OrganizerTier,
  override?: OrganizerLimitsOverride | null
): OrganizerLimits {
  if (role === "admin") {
    return {
      eventsPerDay: Infinity,
      maxUpcoming: null,
      maxCapacity: null,
    };
  }

  const baseLimits = tier === "trusted" ? TRUSTED_TIER_LIMITS : NEW_TIER_LIMITS;

  return {
    eventsPerDay: override?.eventsPerDay !== undefined ? override.eventsPerDay : baseLimits.eventsPerDay,
    maxUpcoming: override?.maxUpcoming !== undefined ? override.maxUpcoming : baseLimits.maxUpcoming,
    maxCapacity: override?.maxCapacity !== undefined ? override.maxCapacity : baseLimits.maxCapacity,
  };
}

/**
 * Returns the count of events created by this user in the rolling last 24 hours.
 */
export async function getEventsCreatedInLast24Hours(userId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.owner, userId), gte(events.created_at, since)))
    .execute();
  return Number(result[0]?.count ?? 0);
}

/**
 * Returns the count of active upcoming events owned by this user.
 */
export async function getUpcomingEventsCount(userId: number): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const result = await db
    .select({ count: count() })
    .from(events)
    .where(and(eq(events.owner, userId), gt(events.end_date, nowSec)))
    .execute();
  return Number(result[0]?.count ?? 0);
}

/**
 * Enforces organizer abuse limits on event creation.
 * Throws TRPCError FORBIDDEN if any limit is exceeded.
 */
export async function assertCanCreateEvent(
  userId: number,
  eventData: { capacity?: number | null; has_registration?: boolean }
): Promise<void> {
  const user = await selectUserById(userId);
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (user.role === "admin") return;

  const accountAgeDays = calculateAccountAgeDays(user.created_at);
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(userId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const limits = computeEffectiveLimits(user.role, tier, user.limits_override);

  // 1. Capacity limit enforcement
  if (limits.maxCapacity !== null) {
    if (eventData.capacity !== undefined && eventData.capacity !== null && eventData.capacity > limits.maxCapacity) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Event capacity (${eventData.capacity}) exceeds allowed limit of ${limits.maxCapacity} for your tier.`,
      });
    }
  }

  // 2. Events per day rate limit enforcement (rolling 24h)
  if (limits.eventsPerDay !== Infinity) {
    const createdToday = await getEventsCreatedInLast24Hours(userId);
    if (createdToday >= limits.eventsPerDay) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Daily event creation limit reached (maximum ${limits.eventsPerDay} events per day).`,
      });
    }
  }

  // 3. Upcoming events capacity enforcement
  if (limits.maxUpcoming !== null) {
    const upcomingCount = await getUpcomingEventsCount(userId);
    if (upcomingCount >= limits.maxUpcoming) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Maximum upcoming events limit reached (maximum ${limits.maxUpcoming} upcoming events).`,
      });
    }
  }
}

/**
 * Enforces organizer abuse limits on event updates (specifically capacity changes).
 * Throws TRPCError FORBIDDEN if capacity exceeds the allowed limit.
 */
export async function assertCanUpdateEvent(
  userId: number,
  eventData: { capacity?: number | null }
): Promise<void> {
  const user = await selectUserById(userId);
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (user.role === "admin") return;

  const accountAgeDays = calculateAccountAgeDays(user.created_at);
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(userId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const limits = computeEffectiveLimits(user.role, tier, user.limits_override);

  // Capacity limit enforcement
  if (limits.maxCapacity !== null) {
    if (eventData.capacity !== undefined && eventData.capacity !== null && eventData.capacity > limits.maxCapacity) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Event capacity (${eventData.capacity}) exceeds allowed limit of ${limits.maxCapacity} for your tier.`,
      });
    }
  }
}

/**
 * Updates or clears limits_override for a user.
 */
export async function setOrganizerLimitsOverride(
  userId: number,
  override: OrganizerLimitsOverride | null
): Promise<boolean> {
  const user = await selectUserById(userId);
  if (!user) return false;

  await db
    .update(users)
    .set({
      limits_override: override,
      updatedAt: new Date(),
      updatedBy: "moderator_limits_override",
    })
    .where(eq(users.user_id, userId))
    .execute();

  await redisTools.deleteCache(getUserCacheKey(userId));
  return true;
}

/**
 * Retrieves a detailed summary of a user's tier, limits, and overrides.
 */
export async function getOrganizerLimitsSummary(userId: number) {
  const user = await selectUserById(userId);
  if (!user) return null;

  const accountAgeDays = calculateAccountAgeDays(user.created_at);
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(userId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const effectiveLimits = computeEffectiveLimits(user.role, tier, user.limits_override);

  return {
    user_id: user.user_id,
    role: user.role,
    tier,
    accountAgeDays: Math.floor(accountAgeDays),
    hasPastCheckIns,
    override: user.limits_override,
    effectiveLimits,
  };
}

export const organizerLimitsService = {
  calculateAccountAgeDays,
  hasPastEventWithCheckedInAttendee,
  determineOrganizerTier,
  computeEffectiveLimits,
  getEventsCreatedInLast24Hours,
  getUpcomingEventsCount,
  assertCanCreateEvent,
  assertCanUpdateEvent,
  setOrganizerLimitsOverride,
  getOrganizerLimitsSummary,
};
