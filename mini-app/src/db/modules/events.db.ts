import { db } from "@/db/db";
import { event_details_search_list, eventRegistrants, events, EventTicketType, rewards, users, visitors } from "@/db/schema";
import { EventRow } from "@/db/schema/events";
import { redisTools } from "@/lib/redisTools";
import { roundDateToInterval } from "@/lib/time.utils";
import { findActivity } from "@/lib/ton-society-api";
import { removeKey } from "@/lib/utils";
import eventFieldsDB from "@/db/modules/eventFields.db";
import { organizerTsVerified } from "@/db/modules/userFlags.db";
import { selectUserById } from "@/db/modules/users.db";
import { is_prod_env } from "@/server/utils/evnutils";
import { validateMiniAppData } from "@/utils";
import searchEventsInputZod from "@/zodSchema/searchEventsInputZod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { z } from "zod";
import { logger } from "../../server/utils/logger";
import { CSBT_EVENT_PRICE, NFT_EVENT_PRICE } from "@/constants";

export const getEventIDCacheKey = (eventID: number) => redisTools.cacheKeys.event_id + eventID;
export const getEventUUIDCacheKey = (eventUUID: string) => redisTools.cacheKeys.event_uuid + eventUUID;

export const deleteEventCache = async (eventIDOrUUID: number | string) => {
  if (typeof eventIDOrUUID === "number") {
    const event = await getEventById(eventIDOrUUID);
    if (event) {
      await redisTools.deleteCache(getEventIDCacheKey(eventIDOrUUID));
      await redisTools.deleteCache(getEventUUIDCacheKey(event.event_uuid));
      logger.log(`Deleted cache for event ${eventIDOrUUID}`);
    }
  } else {
    const event = await getEventByUuid(eventIDOrUUID);
    if (event) {
      await redisTools.deleteCache(getEventIDCacheKey(event.event_id));
      await redisTools.deleteCache(getEventUUIDCacheKey(eventIDOrUUID));
      logger.log(`Deleted cache for event ${eventIDOrUUID}`);
    }
  }
};

export const fetchEventByUuid = async (eventUuid: string): Promise<EventRow | null> => {
  if (eventUuid.length !== 36) {
    return null;
  }
  const cachedEvent = await redisTools.getCache(getEventUUIDCacheKey(eventUuid));
  if (cachedEvent) {
    return cachedEvent;
  }
  const result = (await db.select().from(events).where(eq(events.event_uuid, eventUuid)).execute()).pop();
  if (result) {
    await redisTools.setCache(getEventUUIDCacheKey(eventUuid), result, redisTools.cacheLvl.long);
    await redisTools.setCache(getEventIDCacheKey(result.event_id), result, redisTools.cacheLvl.long);
    return result;
  }
  return null;
};

export const fetchEventById = async (eventId: number): Promise<EventRow | null> => {
  const cachedEvent = await redisTools.getCache(getEventIDCacheKey(eventId));
  if (cachedEvent) {
    return cachedEvent;
  }
  const result = (await db.select().from(events).where(eq(events.event_id, eventId)).execute()).pop();
  if (result) {
    await redisTools.setCache(getEventIDCacheKey(eventId), result, redisTools.cacheLvl.long);
    await redisTools.setCache(getEventUUIDCacheKey(result.event_uuid), result, redisTools.cacheLvl.long);
    return result;
  }
  return null;
};
export const fetchEventByActivityId = async (activityId: number) => {
  return (await db.select().from(events).where(eq(events.activity_id, activityId)).execute()).pop();
};
export const checkIsEventOwner = async (rawInitData: string, eventUuid: string) => {
  const { initDataJson, valid } = await checkIsAdminOrOrganizer(rawInitData);

  if (!valid) {
    return { isOwner: false, valid, initDataJson };
  }

  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.event_uuid, eventUuid), eq(events.hidden, false)))
    .execute();

  if (!event || event[0].owner !== initDataJson.user.id) {
    return { isOwner: false, valid, initDataJson };
  }

  return { isOwner: true, valid, initDataJson };
};

export const checkIsAdminOrOrganizer = async (rawInitData: string) => {
  const data = validateMiniAppData(rawInitData);

  if (!data.valid) {
    return { role: null, ...data };
  }

  const role = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.user_id, data.initDataJson.user.id))
    .execute();

  if (!role || (role[0].role !== "admin" && role[0].role !== "organizer")) {
    return { role: role[0].role, ...data };
  }

  return { role: role[0].role, ...data };
};

export const checkEventTicketToCheckIn = async (eventUuid: string) => {
  // const event = await modules
  //   .select({
  //     event_uuid: events.event_uuid,
  //     ticketToCheckIn: events.ticketToCheckIn,
  //   })
  //   .from(events)
  //   .where(eq(events.event_uuid, eventUuid))
  //   .execute();
  const event = await fetchEventByUuid(eventUuid);

  if (!event) {
    return { event_uuid: null, ticketToCheckIn: null };
  }
  return {
    event_uuid: event?.event_uuid,
    ticketToCheckIn: event.ticketToCheckIn,
  };
};

export const selectEventByUuid = async (eventUuid: string) => {
  if (eventUuid.length !== 36) {
    return null;
  }

  // const eventData = (await modules.select().from(events).where(eq(events.event_uuid, eventUuid)).execute()).pop();
  const eventData = await fetchEventByUuid(eventUuid);

  if (!eventData) {
    return null;
  }

  const restEventData = removeKey(eventData, "secret_phrase");
  let dynamicFields = await eventFieldsDB.getDynamicFields(eventData.event_id);

  const startUTC = Number(eventData.start_date) * 1000;
  const endUTC = Number(eventData.end_date) * 1000;

  const currentTime = Date.now();
  const isNotEnded = currentTime < endUTC;
  const isStarted = currentTime > startUTC;

  return {
    ...restEventData, // Spread the rest of eventData properties
    society_hub: {
      id: restEventData.society_hub_id,
      name: restEventData.society_hub,
    },
    isStarted,
    isNotEnded,
    dynamic_fields: dynamicFields,
    activity_id: restEventData.activity_id,
  };
};

export const getUserEvents = async (userId: number | null, limit: number | 100, offset: number | 0) => {
  if (userId === null) {
    return [];
  }
  const userInfo = await selectUserById(userId);
  if (!userInfo) {
    return [];
  }

  // 1) Return all events for admin
  if (userInfo.role === "admin") {
    const eventQuery = db
      .select({
        event_uuid: events.event_uuid,
        user_id: users.user_id,
        role: users.role,
        created_at: events.created_at,
        owner: events.owner,
      })
      .from(events)
      .innerJoin(users, eq(events.owner, users.user_id));

    return await eventQuery.execute();
  }

  // 2) Non-admin user queries
  // -------------------------
  // a) rewardQuery => from (rewards INNER JOIN visitors)
  const rewardQuery = db
    .select({
      event_uuid: visitors.event_uuid,
      user_id: visitors.user_id,
      role: sql<string>`'participant'`.as("role"),
      created_at: visitors.created_at,
    })
    .from(rewards)
    .innerJoin(visitors, eq(visitors.id, rewards.visitor_id))
    .where(eq(visitors.user_id, userId));

  // // b) eventQuery => events owned by the user if role='organizer'
  // const eventQuery = modules
  //   .select({
  //     event_uuid: events.event_uuid,
  //     user_id: users.user_id,
  //     role: users.role,
  //     created_at: events.created_at,
  //   })
  //   .from(events)
  //   .innerJoin(users, eq(events.owner, users.user_id))
  //   .where(and(eq(users.user_id, userId), eq(users.role, "organizer")));

  // // c) ticketsQuery => user’s paid events (tickets)
  // const ticketsQuery = modules
  //   .select({
  //     event_uuid: tickets.event_uuid,
  //     user_id: tickets.user_id,
  //     role: sql<string>`'participant'`.as("role"),
  //     created_at: tickets.created_at,
  //   })
  //   .from(tickets)
  //   .where(eq(tickets.user_id, userId));

  // d) registrantQuery => from eventRegistrants table
  const registrantQuery = db
    .select({
      event_uuid: eventRegistrants.event_uuid,
      user_id: eventRegistrants.user_id,
      role: sql<string>`'participant'`.as("role"), // or use eventRegistrants.status if you want
      created_at: eventRegistrants.created_at,
    })
    .from(eventRegistrants)
    .where(eq(eventRegistrants.user_id, userId));

  // const userRolesQuery = modules
  //   .select({
  //     event_uuid: events.event_uuid, // from events
  //     user_id: userRoles.userId, // from userRoles
  //     role: userRoles.role, // e.g. 'owner', 'admin', 'checkin_officer'
  //     created_at: userRoles.createdAt, // or userRoles.created_at if you have that column
  //   })
  //   .from(userRoles)
  //   .innerJoin(events, eq(userRoles.itemId, events.event_id))
  //   .where(and(eq(userRoles.userId, userId), eq(userRoles.itemType, "event"), eq(userRoles.status, "active")));

  // 3) Combine queries with unionAll
  //    Drizzle’s unionAll can combine multiple queries of the same shape
  //    (same selected columns & data types).
  //    We then .orderBy, .limit, .offset on the unioned result.

  const combinedResultsQuery = unionAll(rewardQuery, registrantQuery)
    .orderBy((row) => row.created_at)
    .limit(limit)
    .offset(offset);

  // Execute the combined query and return the results
  return await combinedResultsQuery.execute();
};

export const getOrganizerEvents = async (
  organizerId: number,
  limit?: number, // Optional limit
  offset?: number // Optional offset
) => {
  // Set a high limit if none is provided to simulate "no limit"
  const finalLimit = limit !== undefined ? limit : Number.MAX_SAFE_INTEGER;
  const finalOffset = offset !== undefined ? offset : 0;

  const eventsQuery = db
    .select({
      event_uuid: events.event_uuid,
      title: events.title,
      image_url: events.image_url,
      location: events.location,
      start_date: events.start_date,
      end_date: events.end_date,
      participation_type: events.participationType,
      hidden: events.hidden,
      society_hub_id: events.society_hub_id,
      ticket_to_check_in: events.ticketToCheckIn,
      timezone: events.timezone,
    })
    .from(events)
    .where(eq(events.owner, organizerId))
    .orderBy(desc(events.start_date))
    .limit(finalLimit)
    .offset(finalOffset);

  // Return the result of the query
  return await eventsQuery.execute();
};

export const getEventsWithFilters = async (
  params: z.infer<typeof searchEventsInputZod>,
  user_id: number
): Promise<{ eventsData: any[]; rowsCount: number }> => {
  const { limit = 10, cursor = 0, search, filter, sortBy = "default", useCache = false } = params;
  const roundMinutesInMs = 60; // don't touch this fucking value it will break the cache or made unexpected results

  if (filter?.startDate && useCache) {
    filter.startDate = roundDateToInterval(filter?.startDate, roundMinutesInMs);
  }
  if (filter?.endDate && useCache) {
    filter.endDate = roundDateToInterval(filter?.endDate, roundMinutesInMs);
  }
  const stringToHash = JSON.stringify({
    limit,
    cursor,
    search,
    filter,
    sortBy,
  });
  // Create MD5 hash

  const hash = crypto.createHash("md5").update(stringToHash).digest("hex");
  const cacheKey = redisTools.cacheKeys.getEventsWithFilters + hash;
  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult && useCache) {
    return cachedResult;
  }

  let query = db.select().from(event_details_search_list);
  let userEventUuids = [];
  // Initialize an array to hold the conditions
  let conditions = [];

  // Apply event type filters
  if (filter?.participationType?.length) {
    conditions.push(
      or(
        filter.participationType.includes("online") ? eq(event_details_search_list.participationType, "online") : sql`false`,
        filter.participationType.includes("in_person")
          ? eq(event_details_search_list.participationType, "in_person")
          : sql`false`
      )
    );
  }
  // Apply user_id filter

  if (filter?.user_id && (filter.user_id === user_id || filter?.organizer_user_id === user_id)) {
    const userEvents = await getUserEvents(filter.user_id, 1000, 0);
    userEventUuids = userEvents.map((event) => event.event_uuid);
    if (userEventUuids.length) {
      filter.event_uuids = userEventUuids;
    } else {
      return { eventsData: [], rowsCount: 0 };
    }
  }
  // Apply date filters
  if (filter?.startDate && filter?.startDateOperator) {
    conditions.push(sql`${event_details_search_list.startDate}
    ${sql.raw(filter.startDateOperator)}
    ${filter.startDate}`);
  }

  if (filter?.endDate && filter?.endDateOperator) {
    conditions.push(sql`${event_details_search_list.endDate}
    ${sql.raw(filter.endDateOperator)}
    ${filter.endDate}`);
  }

  // Apply hidden condition
  if (user_id)
    conditions.push(
      sql`(${event_details_search_list.hidden} = ${false} or ${event_details_search_list.organizerUserId} = ${user_id})`
    );

  // Apply organizer_user_id filter
  if (filter?.organizer_user_id) {
    conditions.push(eq(event_details_search_list.organizerUserId, filter.organizer_user_id));
  }

  // Apply event_ids filter
  if (filter?.event_ids && filter.event_ids.length) {
    conditions.push(sql`${event_details_search_list.eventId}
    = any(
    ${filter.event_ids}
    )`);
  }
  // Apply society_hub_id filter
  if (filter?.society_hub_id && filter.society_hub_id.length) {
    conditions.push(inArray(event_details_search_list.societyHubID, filter.society_hub_id));
  }
  // Apply event_uuids filter
  if (filter?.event_uuids && filter.event_uuids.length) {
    const validEventUuids = filter.event_uuids.filter((uuid) => uuid !== null && uuid !== undefined && uuid.length === 36);

    if (validEventUuids.length) {
      conditions.push(inArray(event_details_search_list.eventUuid, validEventUuids));
    }
  }
  if (filter?.category_id && filter.category_id.length > 0) {
    conditions.push(inArray(event_details_search_list.categoryId, filter.category_id));
  }
  // Add ongoing events filter
  if (filter?.eventStatus === "ongoing") {
    const currentTime = Math.floor(Date.now() / 1000);
    conditions.push(
      and(
        sql`${event_details_search_list.startDate} <=
        ${currentTime}`,
        sql`${event_details_search_list.endDate} >
        ${currentTime}`
      )
    );
  } else if (filter?.eventStatus === "upcoming") {
    const currentTime = Math.floor(Date.now() / 1000);
    conditions.push(sql`${event_details_search_list.startDate} >
    ${currentTime}`);
  } else if (filter?.eventStatus === "not_ended") {
    const currentTime = Math.floor(Date.now() / 1000);
    conditions.push(sql`${event_details_search_list.endDate} >
    ${currentTime}`);
  } else if (filter?.eventStatus === "ended") {
    const currentTime = Math.floor(Date.now() / 1000);
    conditions.push(sql`${event_details_search_list.endDate} <=
    ${currentTime}`);
  }

  // Apply search filters
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        sql`${event_details_search_list.title}
        ILIKE
        ${searchPattern}`,
        sql`${event_details_search_list.organizerFirstName}
        ILIKE
        ${searchPattern}`,
        sql`${event_details_search_list.organizerLastName}
        ILIKE
        ${searchPattern}`,
        sql`${event_details_search_list.location}
        ILIKE
        ${searchPattern}`
      )
    );

    let orderByClause;
    if (sortBy === "start_date_asc") {
      orderByClause = sql`start_date
      ASC`;
    } else if (sortBy === "start_date_desc" || sortBy === "default") {
      orderByClause = sql`start_date
      DESC`;
    } else if (sortBy === "most_people_reached") {
      orderByClause = sql`visitor_count
      DESC`;
    } else if (sortBy === "do_not_order") {
      orderByClause = sql``;
    }

    // @ts-expect-error
    query = query.orderBy(
      sql`${
        orderByClause
          ? sql`${orderByClause}
      ,`
          : sql``
      }
      greatest(
          similarity(
      ${event_details_search_list.title},
      ${search}
      ),
      similarity
      (
      ${event_details_search_list.location},
      ${search}
      )
      )
      DESC`
    );
  }

  // Apply all conditions with AND
  if (conditions.length) {
    // @ts-expect-error
    query = query.where(and(...conditions));
  }

  // Apply sorting if no search is specified
  if (!search) {
    if (sortBy === "start_date_asc") {
      // @ts-expect-error
      query = query.orderBy(asc(event_details_search_list.startDate));
    } else if (sortBy === "start_date_desc") {
      // @ts-expect-error
      query = query.orderBy(desc(event_details_search_list.startDate));
    } else if (sortBy === "most_people_reached" || sortBy === "default") {
      // @ts-expect-error
      query = query.orderBy(desc(event_details_search_list.visitorCount));
    } else if (sortBy === "random") {
      // @ts-expect-error
      query = query.orderBy(sql`random
          ()`);
    }
  }

  const rowsCount = (
    await db
      .select({ count: count() })
      .from(event_details_search_list)
      .where(and(...conditions))
  )[0].count;

  // Apply pagination
  if (limit) {
    // @ts-expect-error
    query = query.limit(limit).offset(cursor * (limit - 1));
  }

  //logSQSLQuery(query.toSQL().sql, query.toSQL().params);
  const eventsData = await query.execute();

  const queryResult = { eventsData, rowsCount } as const;
  await redisTools.setCache(cacheKey, queryResult, redisTools.cacheLvl.guard);

  return queryResult;
};

export const getEventByUuid = async (eventUuid: string, removeSecret: boolean = true) => {
  // const event = await modules.select().from(events).where(eq(events.event_uuid, eventUuid)).execute();
  const event = await fetchEventByUuid(eventUuid);
  if (!event) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Event not found  ${eventUuid}`,
    });
  }
  // remove the secret_phrase from the response
  const { secret_phrase, ...restEvent } = event;
  return removeSecret ? restEvent : event;
};

export const getEventById = async (eventId: number) => {
  // const event = await modules.select().from(events).where(eq(events.event_id, eventId)).execute();
  return await fetchEventById(eventId);
};

export const getEventsForSpecialRole = async (userRole: string, userId?: number) => {
  if (userRole === "admin") {
    return await db.select().from(events).where(eq(events.hidden, false)).orderBy(desc(events.created_at)).execute();
  } else if (userRole === "organizer" && userId) {
    return await db
      .select()
      .from(events)
      .where(and(eq(events.hidden, false), eq(events.owner, userId)))
      .orderBy(desc(events.created_at))
      .execute();
  } else {
    return [];
  }
};

export const getOrganizerHosted = async (params: {
  organizerId?: number;
  hidden: boolean;
  offset: number;
  limit: number;
}): Promise<{ eventsData: any[]; rowsCount: number }> => {
  const { organizerId, hidden = false, offset, limit } = params;

  if (!organizerId) {
    return { eventsData: [], rowsCount: 0 };
  }

  try {
    const conditions = and(
      eq(event_details_search_list.hidden, hidden),
      eq(event_details_search_list.organizerUserId, organizerId)
    );
    const query = db
      .select()
      .from(event_details_search_list)
      .where(conditions)
      .orderBy(desc(event_details_search_list.startDate))
      .offset(offset)
      .limit(limit);

    const rowsCount = (await db.select({ count: count() }).from(event_details_search_list).where(conditions))[0].count;
    const eventsData = await query.execute();

    return { eventsData, rowsCount };
  } catch (error) {
    logger.error("Error in getOrganizerHosted", error);
    throw new Error("Error in getOrganizerHosted");
  }
};

//  get ongoing events
export const fetchOngoingEvents = async () => {
  const currentTime = Math.floor(Date.now() / 1000);
  logger.log("check for events is ongoing in currentTime", currentTime);
  return await db
    .select()
    .from(events)
    .where(and(eq(events.hidden, false), lt(events.start_date, currentTime), gt(events.end_date, currentTime)))
    .execute();
};

/**
 * Fetch a chunk of events that have a non-null activity_id,
 * sorted descending by event_id.
 */
export async function fetchEventsWithNonNullActivityIdDESC(limit: number, offset: number): Promise<EventRow[]> {
  return await db
    .select()
    .from(events)
    .where(and(isNotNull(events.activity_id), eq(events.event_id, 1971)))
    .orderBy(sql`${events.event_id} DESC`)
    .limit(limit)
    .offset(offset)
    .execute();
}

/**
 * Fetch events with a non-null activity_id and start_date > given cutoff,
 * in descending order by event_id.
 */
export async function fetchEventsWithNonNullActivityIdAfterStartDateDESC(
  limit: number,
  offset: number,
  startDateCutoff: number
): Promise<EventRow[]> {
  return await db
    .select()
    .from(events)
    .where(and(isNotNull(events.activity_id), gt(events.start_date, startDateCutoff)))
    .orderBy(sql`${events.event_id} ASC`)
    .limit(limit)
    .offset(offset)
    .execute();
}

/**
 * Fetch all events (via visitors) that have pending rewards, sorted by event end_date descending.
 */
export const fetchEventsWithPendingRewards = async () =>
  db
    .select({
      eventUuid: events.event_uuid,
      eventEndDate: events.end_date,
    })
    .from(rewards)
    .innerJoin(visitors, eq(visitors.id, rewards.visitor_id))
    .innerJoin(events, eq(visitors.event_uuid, events.event_uuid))
    .where(eq(rewards.status, "pending_creation"))
    .groupBy(events.event_uuid, events.end_date)
    .orderBy(desc(events.end_date));

const updateEventSbtCollection = async (
  start_date: number | null | undefined,
  end_date: number | null | undefined,
  activity_id: number | null | undefined,
  sbt_collection_address: string | null | undefined,
  event_uuid: string | null | undefined
) => {
  if (!start_date || !end_date || !activity_id) return;
  /* -------------------------------------------------------------------------- */
  const now = Date.now();
  if (now < start_date) return;
  /* -------------------------------------------------------------------------- */
  if (sbt_collection_address) return;
  /* -------------------------------------------------------------------------- */
  // Keeping Low Load if sbt-collection is not
  // Check only 10% of time if event is not ended
  const checkSbtCollection = now > end_date ? now % 3 !== 1 : now % 10 === 1;
  if (checkSbtCollection) {
    try {
      const result = await findActivity(activity_id);
      const sbt_collection_address = result.data.rewards.collection_address;
      if (sbt_collection_address) {
        await db
          .update(events)
          .set({ sbt_collection_address: sbt_collection_address })
          .where(eq(events.activity_id, activity_id))
          .execute();
        await eventDB.deleteEventCache(event_uuid!!);
      }
    } catch (error) {
      return;
    }
  }
};

export const getPaidEventPrice = (capacity: number, ticketType: EventTicketType): number => {
  // test environments for all ticket types:
  const notProductionPrice = 0.001 + 0.00055 * capacity;
  // NFT Event Creation Price
  const nftEventCreationPrice = NFT_EVENT_PRICE + 0.06 * capacity;
  // TSCSBT Event Creation Price
  const tscsbtEventCreationPrice = CSBT_EVENT_PRICE; // we didnt get money for tscsbt event creation capacity

  // local/dev/stage environments for all ticket types:
  if (!is_prod_env()) {
    return notProductionPrice;
  }
  // For production:
  switch (ticketType) {
    case "NFT":
      return nftEventCreationPrice;
    case "TSCSBT":
      return tscsbtEventCreationPrice;
    default:
      throw new Error(`Unsupported ticket type: ${ticketType}`);
  }
};

const shouldEventBeHidden = async (event_is_paid: boolean, user_id: number) => {
  if (event_is_paid) return true;

  const is_ts_verified = await organizerTsVerified(user_id);

  if (!is_ts_verified) return true;

  return false;
};
const updateActivityId = async (event_uuid: string, activity_id: number) => {
  await db.update(events).set({ activity_id }).where(eq(events.event_uuid, event_uuid)).execute();
  await eventDB.deleteEventCache(event_uuid);
};

export const fetchUpcomingEventsWithGroup = async (timeInSeconds: number) =>
  await db
    .select()
    .from(events)
    .where(
      and(
        isNotNull(events.eventTelegramGroup),
        gt(events.end_date, timeInSeconds) // i.e., event end time > current time
      )
    )
    .execute();

const patchEvent = async (idOrUuid: number | string, payload: Partial<typeof events.$inferInsert>) => {
  // 1️⃣  build a proper WHERE clause
  const where = typeof idOrUuid === "number" ? eq(events.event_id, idOrUuid) : eq(events.event_uuid, idOrUuid);

  // 2️⃣  execute the update
  await db.update(events).set(payload).where(where);

  // 3️⃣  wipe both id- & uuid-based caches
  await deleteEventCache(idOrUuid);
};

const eventDB = {
  checkIsEventOwner,
  checkIsAdminOrOrganizer,
  checkEventTicketToCheckIn,
  selectEventByUuid,
  getUserEvents,
  getOrganizerEvents,
  getEventsWithFilters,
  getEventByUuid,
  getEventById,
  getEventsForSpecialRole,
  getOrganizerHosted,
  fetchOngoingEvents,
  fetchEventByUuid,
  fetchEventById,
  deleteEventCache,
  fetchEventByActivityId,
  fetchEventsWithPendingRewards,
  fetchEventsWithNonNullActivityIdDESC,
  fetchEventsWithNonNullActivityIdAfterStartDateDESC,
  updateEventSbtCollection,
  getPaidEventPrice,
  shouldEventBeHidden,
  updateActivityId,
  fetchUpcomingEventsWithGroup,
  patchEvent,
};
export default eventDB;
