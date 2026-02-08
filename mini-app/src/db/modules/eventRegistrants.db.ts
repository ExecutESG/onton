import { db } from "@/db/db";
import { eventRegistrants, notifications, visitors, events } from "@/db/schema";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, ne, not, or, sql } from "drizzle-orm";

export const fetchApprovedUsers = async (
  eventUuid: string,
  triggerId: number,
  lastUserId: number,
  pageSize: number
): Promise<{ userId: number }[]> => {
  try {
    const approvedUsers = await db
      .select({ userId: eventRegistrants.user_id })
      .from(eventRegistrants)
      .where(
        and(
          eq(eventRegistrants.event_uuid, eventUuid),
          eq(eventRegistrants.status, "approved"),
          // Exclude users who have already been sent a notification for this trigger
          not(
            inArray(
              eventRegistrants.user_id,
              db
                .select({ userId: notifications.userId })
                .from(notifications)
                .where(
                  and(
                    eq(notifications.item_type, "POA_TRIGGER"),
                    eq(notifications.itemId, triggerId),
                    ne(notifications.status, "REPLIED")
                  )
                )
            )
          ),
          // Keyset pagination: fetch users with ID greater than the last processed ID
          gt(eventRegistrants.user_id, lastUserId)
        )
      )
      .limit(pageSize)
      .orderBy(asc(eventRegistrants.user_id)) // Correct usage of asc
      .execute();

    return approvedUsers as { userId: number }[];
  } catch (error) {
    console.error(`Error fetching approved users for Event UUID ${eventUuid} and Trigger ID ${triggerId}:`, error);
    throw error; // Propagate the error to be handled by the caller
  }
};
export const getByEventUuidAndUserId = async (eventUuid: string, userId: number) => {
  try {
    const result = await db
      .select()
      .from(eventRegistrants)
      .where(and(eq(eventRegistrants.event_uuid, eventUuid), eq(eventRegistrants.user_id, userId)))
      .execute();
    return result.pop();
  } catch (error) {
    console.error(`Error fetching Event Registrant for Event UUID ${eventUuid} and User ID ${userId}:`, error);
    throw error; // Propagate the error to be handled by the caller
  }
};

export const getRegistrantRequest = async (event_uuid: string, user_id: number) => {
  return (
    await db
      .select()
      .from(eventRegistrants)
      .where(and(eq(eventRegistrants.event_uuid, event_uuid), eq(eventRegistrants.user_id, user_id)))
      .execute()
  ).pop();
};

export const getApprovedRequestsCount = async (event_uuid: string) => {
  return (
    (
      await db
        .select({ count: count() })
        .from(eventRegistrants)
        .where(
          and(
            or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin")),
            eq(eventRegistrants.event_uuid, event_uuid)
          )
        )
        .execute()
    ).pop()?.count || 0
  );
};

export const getNotRejectedRequestsCount = async (event_uuid: string) => {
  return (
    (
      await db
        .select({ count: count() })
        .from(eventRegistrants)
        .where(and(ne(eventRegistrants.status, "rejected"), eq(eventRegistrants.event_uuid, event_uuid)))
        .execute()
    ).pop()?.count || 0
  );
};

export const getEventsByUserIdForListing = async (userId: number) => {
  try {
    const result = await db
      .select({
        event_uuid: eventRegistrants.event_uuid,
        user_id: eventRegistrants.user_id,
        role: sql<string>`'participant'`.as("role"),
        created_at: visitors.created_at,
      })
      .from(eventRegistrants)
      .innerJoin(events, eq(eventRegistrants.event_uuid, events.event_uuid))
      .where(eq(eventRegistrants.user_id, userId))
      .execute();

    return result;
  } catch (error) {
    console.error(`Error fetching events for User ID ${userId}:`, error);
    throw error;
  }
};

/**
 * Fetch registrants who are rejected but still have a stored invite link.
 */
export const fetchRejectedUsersWithLink = async (eventUuid: string) =>
  await db
    .select()
    .from(eventRegistrants)
    .where(
      and(
        eq(eventRegistrants.event_uuid, eventUuid),
        eq(eventRegistrants.status, "rejected"),
        isNotNull(eventRegistrants.telegram_invite_link)
      )
    )
    .execute();

/**
 * Set `telegram_invite_link = NULL` for a specific registrant by ID.
 */
export const clearInviteLink = async (registrantId: number) => {
  await db
    .update(eventRegistrants)
    .set({ telegram_invite_link: null })
    .where(eq(eventRegistrants.id, registrantId))
    .execute();
};

/**
 * Fetch registrants who have status = approved or checkedin
 * but do NOT have an invitation link yet.
 */
export const fetchNeedInviteLink = async (eventUuid: string) =>
  await db
    .select()
    .from(eventRegistrants)
    .where(
      and(
        eq(eventRegistrants.event_uuid, eventUuid),
        inArray(eventRegistrants.status, ["approved", "checkedin"]),
        or(eq(eventRegistrants.telegram_invite_link, ""), isNull(eventRegistrants.telegram_invite_link))
      )
    )
    .execute();

/**
 * Update a registrant's row to store the newly created invite link.
 */
export const setInviteLink = async (registrantId: number, inviteLink: string) => {
  await db
    .update(eventRegistrants)
    .set({ telegram_invite_link: inviteLink, updatedBy: "invitor" })
    .where(eq(eventRegistrants.id, registrantId))
    .execute();
};

export const eventRegistrantsDB = {
  fetchApprovedUsers,
  getByEventUuidAndUserId,
  getNotRejectedRequestsCount,
  getApprovedRequestsCount,
  getRegistrantRequest,
  getEventsByUserIdForListing,
  fetchRejectedUsersWithLink,
  clearInviteLink,
  fetchNeedInviteLink,
  setInviteLink,
};
