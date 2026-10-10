import { db } from "@/db/db";
import { events, eventRegistrants, tickets, users } from "@/db/schema";
import { and, eq, lte, gte, gt, count } from "drizzle-orm";
import { OrganizerLimitsOverride } from "@/db/schema/users";

export type OrganizerTier = "new" | "trusted";
export interface OrganizerLimits { eventsPerDay: number; maxUpcoming: number | null; maxCapacity: number | null; }
import { TRPCError } from "@trpc/server";
import { redisTools } from "@/lib/redisTools";
import { getUserCacheKey } from "@/db/modules/users.db";

export const NEW_TIER_LIMITS: OrganizerLimits = {
  eventsPerDay: 2,
  maxUpcoming: 5,
  maxCapacity: 500,
};

export const TRUSTED_TIER_LIMITS: OrganizerLimits = {
  eventsPerDay: 5,
  maxUpcoming: null, // Unlimited upcoming
  maxCapacity: null, // Unlimited capacity
};

export function calculateAccountAgeDays(createdAt: Date): number {
  return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
}

export async function selectUserById(userId: number) {
  const userRows = await db
    .select({
      user_id: users.user_id,
      role: users.role,
      created_at: users.created_at,
      limits_override: users.limits_override,
    })
    .from(users)
    .where(eq(users.user_id, userId))
    .limit(1)
    .execute();
  return userRows[0] || null;
}

export async function hasPastEventWithCheckedInAttendee(userId: number): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const registrantsCheck = await db
    .select({ id: eventRegistrants.id })
    .from(eventRegistrants)
    .innerJoin(events, eq(eventRegistrants.event_uuid, events.event_uuid))
    .where(and(eq(events.owner, userId), lte(events.end_date, nowSec), eq(eventRegistrants.status, "checkedin")))
    .limit(1)
    .execute();
  if (registrantsCheck.length > 0) return true;

  const ticketsCheck = await db
    .select({ id: tickets.id })
    .from(tickets)
    .innerJoin(events, eq(tickets.event_uuid, events.event_uuid))
    .where(and(eq(events.owner, userId), lte(events.end_date, nowSec), eq(tickets.status, "USED")))
    .limit(1)
    .execute();
  return ticketsCheck.length > 0;
}

export function determineOrganizerTier(accountAgeDays: number, hasPastCheckIns: boolean): OrganizerTier {
  if (accountAgeDays >= 30) return "trusted";
  if (accountAgeDays >= 7 && hasPastCheckIns) return "trusted";
  return "new";
}

export function computeEffectiveLimits(
  role: string,
  tier: OrganizerTier,
  override?: OrganizerLimitsOverride | null
): OrganizerLimits {
  if (role === "admin") {
    return { eventsPerDay: Infinity, maxUpcoming: null, maxCapacity: null };
  }
  const baseLimits = tier === "trusted" ? TRUSTED_TIER_LIMITS : NEW_TIER_LIMITS;
  return {
    eventsPerDay: override?.eventsPerDay !== undefined ? override.eventsPerDay : baseLimits.eventsPerDay,
    maxUpcoming: override?.maxUpcoming !== undefined ? override.maxUpcoming : baseLimits.maxUpcoming,
    maxCapacity: override?.maxCapacity !== undefined ? override.maxCapacity : baseLimits.maxCapacity,
  };
}

export async function getEventsCreatedInLast24Hours(userId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await db.select({ count: count() }).from(events).where(and(eq(events.owner, userId), gte(events.created_at, since))).execute();
  return Number(result[0]?.count ?? 0);
}

export async function getUpcomingEventsCount(userId: number): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  // Delisted events are included per CTO doc
  const result = await db.select({ count: count() }).from(events).where(and(eq(events.owner, userId), gt(events.end_date, nowSec))).execute();
  return Number(result[0]?.count ?? 0);
}

export async function assertCanCreateEvent(
  userId: number,
  eventData: { capacity?: number | null; has_registration?: boolean }
): Promise<void> {
  const user = await selectUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  if (user.role === "admin") return;

  const accountAgeDays = calculateAccountAgeDays(user.created_at ?? new Date());
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(userId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const limits = computeEffectiveLimits(user.role, tier, user.limits_override);

  if (limits.maxCapacity !== null) {
    const isRegistrationOn = eventData.has_registration !== false;
    if (isRegistrationOn && eventData.capacity === null) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Unlimited capacity is not allowed for your tier (max ${limits.maxCapacity}).` });
    }
    if (eventData.capacity !== undefined && eventData.capacity !== null && eventData.capacity > limits.maxCapacity) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Event capacity (${eventData.capacity}) exceeds allowed limit of ${limits.maxCapacity} for your tier.` });
    }
  }

  if (limits.eventsPerDay !== Infinity) {
    const createdToday = await getEventsCreatedInLast24Hours(userId);
    if (createdToday >= limits.eventsPerDay) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Daily event creation limit reached (maximum ${limits.eventsPerDay} events per day).` });
    }
  }

  if (limits.maxUpcoming !== null) {
    const upcomingCount = await getUpcomingEventsCount(userId);
    if (upcomingCount >= limits.maxUpcoming) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Maximum upcoming events limit reached (maximum ${limits.maxUpcoming} upcoming events).` });
    }
  }
}

export async function assertCanUpdateEvent(
  editorId: number,
  ownerId: number,
  oldEvent: { capacity: number | null },
  eventData: { capacity?: number | null; has_registration?: boolean }
): Promise<void> {
  const editor = await selectUserById(editorId);
  if (editor && editor.role === "admin") return;

  const owner = await selectUserById(ownerId);
  if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Owner not found" });

  const accountAgeDays = calculateAccountAgeDays(owner.created_at ?? new Date());
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(ownerId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const limits = computeEffectiveLimits(owner.role, tier, owner.limits_override);

  if (limits.maxCapacity !== null) {
    const newCapacity = eventData.capacity !== undefined ? eventData.capacity : oldEvent.capacity;
    const isRegistrationOn = eventData.has_registration !== undefined ? eventData.has_registration : true; // default on if true in db, wait, we don't know db has_registration here unless we pass it. But we just check if newCapacity goes up or becomes null.
    
    // Enforce only when the capacity goes up (or becomes null) and exceeds the cap.
    let capacityIncreased = false;
    if (newCapacity === null && oldEvent.capacity !== null) {
      capacityIncreased = true;
    } else if (newCapacity !== null && oldEvent.capacity !== null && newCapacity > oldEvent.capacity) {
      capacityIncreased = true;
    }

    if (capacityIncreased) {
      if (newCapacity === null && isRegistrationOn) {
         throw new TRPCError({ code: "FORBIDDEN", message: `Unlimited capacity is not allowed for your tier (max ${limits.maxCapacity}).` });
      }
      if (newCapacity !== null && newCapacity > limits.maxCapacity) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Event capacity (${newCapacity}) exceeds allowed limit of ${limits.maxCapacity} for your tier.` });
      }
    }
  }
}

export async function setOrganizerLimitsOverride(
  userId: number,
  override: OrganizerLimitsOverride | null
): Promise<boolean> {
  const user = await selectUserById(userId);
  if (!user) return false;

  await db.update(users).set({ limits_override: override, updatedAt: new Date(), updatedBy: "moderator_limits_override" }).where(eq(users.user_id, userId)).execute();
  await redisTools.deleteCache(getUserCacheKey(userId));
  return true;
}

export async function getOrganizerLimitsSummary(userId: number) {
  const user = await selectUserById(userId);
  if (!user) return null;

  const accountAgeDays = calculateAccountAgeDays(user.created_at ?? new Date());
  const hasPastCheckIns = await hasPastEventWithCheckedInAttendee(userId);
  const tier = determineOrganizerTier(accountAgeDays, hasPastCheckIns);
  const effectiveLimits = computeEffectiveLimits(user.role, tier, user.limits_override);

  return {
    userId: user.user_id,
    role: user.role,
    tier,
    accountAgeDays: Math.floor(accountAgeDays),
    hasPastCheckIns,
    override: user.limits_override,
    effectiveLimits,
    isAdmin: user.role === "admin",
    eventsCreatedLast24Hours: await getEventsCreatedInLast24Hours(userId),
    upcomingEventsCount: await getUpcomingEventsCount(userId),
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
