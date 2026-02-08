import { db } from "@/db/db";
import { eventFields, events, rewards, specialGuests, tickets, userEventFields, users, visitors } from "@/db/schema";
import { and, between, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { checkEventTicketToCheckIn } from "@/db/modules/events.db";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";
import { getUserCacheKey } from "@/db/modules/users.db";
import { VisitorsRow } from "@/db/schema/visitors";

const getVisitorCacheKey = (user_id: number, event_uuid: string) => `visitor:${user_id}:${event_uuid}`;

const findVisitorByUserAndEvent = async (user_id: number, event_uuid: string) => {
  const cacheKey = getVisitorCacheKey(user_id, event_uuid);
  const cachedVisitor = await redisTools.getCache(cacheKey);

  if (cachedVisitor) {
    // logger.log("Cache hit for:", cacheKey);
    return JSON.parse(cachedVisitor);
  }

  const visitorsFound = await db
    .select()
    .from(visitors)
    .where(and(eq(visitors.user_id, user_id), eq(visitors.event_uuid, event_uuid)))
    .execute();

  const visitor = visitorsFound?.[0] ?? null;

  // Cache the result
  if (visitor) {
    await redisTools.setCache(cacheKey, JSON.stringify(visitor), redisTools.cacheLvl.long);
  }

  return visitor;
};
const insertNewVisitor = async (user_id: number, event_uuid: string) => {
  const insertedVisitor = await db
    .insert(visitors)
    .values({
      user_id: user_id,
      event_uuid: event_uuid,
      updatedBy: "system",
    })
    .returning()
    .execute();

  const visitor = insertedVisitor?.[0] ?? null;

  // Cache the newly inserted visitor
  if (visitor) {
    const cacheKey = getVisitorCacheKey(user_id, event_uuid);
    await redisTools.setCache(cacheKey, JSON.stringify(visitor), redisTools.cacheLvl.long);
  }

  return visitor;
};

const generateRandomVisitor = (userId: number) => ({
  user_id: userId,
  username: `user_${userId}`,
  first_name: `FirstName${userId}`,
  last_name: `LastName${userId}`,
  wallet_address: `0x${Math.random().toString(36).substring(2, 15)}`,
  created_at: new Date().toISOString(),
  dynamicFields: [
    {
      event_field_id: Math.trunc(Math.random() * 10000),
      data: `Sample data ${userId}`,
    },
  ],
});

export const selectVisitorsByEventUuidMock = async (event_uuid: string, limit: number, cursor: number) => {
  const visitorsData = Array.from({ length: limit }, (_, index) => generateRandomVisitor(cursor + index + 1));

  const moreRecordsAvailable = visitorsData.length === limit; // Simulate the possibility of more records

  return {
    visitorsWithDynamicFields: visitorsData,
    moreRecordsAvailable,
    nextCursor: moreRecordsAvailable ? cursor + limit : null,
  };
};

export const selectValidVisitorById = async (visitorId: number) => {
  return db
    .select({
      user_id: visitors.user_id,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      wallet_address: users.wallet_address,
      created_at: visitors.created_at,
    })
    .from(visitors)
    .leftJoin(users, eq(visitors.user_id, users.user_id))
    .leftJoin(events, eq(events.event_uuid, visitors.event_uuid))
    .where(
      and(
        eq(visitors.id, visitorId),
        isNotNull(events.start_date),
        isNotNull(events.end_date),
        isNotNull(users.wallet_address),
        between(
          visitors.last_visit,
          sql`TO_TIMESTAMP
              (events.start_date)`,
          sql`TO_TIMESTAMP
              (events.end_date)`
        ),
        eq(
          db
            .select({
              count: sql`count
                  (*)`.mapWith(Number),
            })
            .from(userEventFields)
            .where(
              and(
                eq(userEventFields.user_id, visitors.user_id),
                eq(userEventFields.completed, true),
                eq(userEventFields.event_id, events.event_id)
              )
            ),
          db
            .select({
              count: sql`count
                  (*)`.mapWith(Number),
            })
            .from(eventFields)
            .where(and(eq(eventFields.event_id, events.event_id)))
        )
      )
    );
};

export const selectVisitorsByEventUuid = async (
  event_uuid: string,
  limit: number,
  cursor: number = 0,
  dynamic_fields: boolean = true,
  search?: string
) => {
  const eventTicketToCheckIn = await checkEventTicketToCheckIn(event_uuid);

  let visitorsData;
  if (!eventTicketToCheckIn.ticketToCheckIn) {
    // Query for visitors without tickets
    let userDataQuery = db
      .select({
        user_id: visitors.user_id,
        username: users.username,
        first_name: users.first_name,
        last_name: users.last_name,
        wallet_address: users.wallet_address,
        created_at: visitors.created_at,
        has_ticket: sql<boolean>`false`.as("has_ticket"),
        ticket_status: sql<string>`null`.as("ticket_status"),
        ticket_id: sql<number>`null`.as("ticket_id"),
        ticket_created_at: visitors.created_at,
        ticket_order_id: sql`null`.as("ticket_order_id"),
        ticket_qr_code: sql`null`.as("ticket_qr_code"),
        ticket_position: sql`null`.as("ticket_position"),
        ticket_company: sql`null`.as("ticket_company"),
        ticket_nft_address: sql`null`.as("ticket_nft_address"),
        badge_info: sql<string>`
            CASE 
            WHEN
            ${users.username}
            =
            'null'
            THEN
            'https://t.me/theontonbot'
            ELSE
            CONCAT
            (
            'https://t.me/',
            REPLACE
            (
            ${users.username},
            '@',
            ''
            )
            )
            END
        `.as("badge"),
      })
      .from(visitors)
      .leftJoin(users, eq(visitors.user_id, users.user_id))
      .leftJoin(rewards, eq(visitors.id, rewards.visitor_id))
      .where(
        and(
          isNotNull(rewards.id),
          eq(visitors.event_uuid, event_uuid),
          search
            ? or(
                ilike(users.username, `%${search}%`),
                ilike(users.first_name, `%${search}%`),
                ilike(users.last_name, `%${search}%`)
              )
            : sql`true`
        )
      )
      .orderBy(desc(visitors.created_at))
      .limit(limit)
      .offset(cursor || 0);

    visitorsData = await userDataQuery.execute();
  } else {
    // Query for tickets with optional special guests
    let ticketQueryData = db
      .select({
        user_id: tickets.user_id,
        username: sql<string>`
            CASE 
            WHEN TRIM(
            ${tickets.telegram}
            )
            =
            '@null'
            THEN
            CAST
            (
            ${users.user_id}
            AS
            VARCHAR
            )
            ELSE
            REPLACE
            (
            TRIM
            (
            ${tickets.telegram}
            ),
            '@',
            ''
            )
            END
        `.as("username"),
        first_name: tickets.name,
        last_name: sql<string>`''`.as("last_name"),
        wallet_address: sql`null`.as("wallet_address"),
        created_at: tickets.created_at,
        has_ticket: sql<boolean>`true`.as("has_ticket"),
        ticket_status: tickets.status,
        ticket_id: tickets.id,
        ticket_order_id: tickets.order_uuid,
        ticket_qr_code: tickets.order_uuid,
        ticket_position: tickets.position,
        ticket_company: tickets.company,
        ticket_nft_address: tickets.nftAddress,
        ticket_created_at: tickets.created_at,
        badge_info: sql<string>`
            CASE 
            WHEN
            ${tickets.telegram}
            =
            '@null'
            THEN
            'https://t.me/theontonbot'
            ELSE
            CONCAT
            (
            'https://t.me/',
            REPLACE
            (
            ${tickets.telegram},
            '@',
            ''
            )
            )
            END
        `.as("badge"),
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.user_id, users.user_id))
      .where(
        and(
          eq(tickets.event_uuid, event_uuid),
          search
            ? or(
                ilike(users.username, `%${search}%`),
                ilike(users.first_name, `%${search}%`),
                ilike(users.last_name, `%${search}%`)
              )
            : sql`true`
        )
      )
      .limit(limit)
      .offset(cursor || 0);

    const ticketDataResults = await ticketQueryData.execute();

    if (cursor === 0) {
      // Query for special guests when cursor is 0
      const specialGuestQueryData = await db
        .select({
          user_id: sql<number>`
              CASE 
        WHEN
              ${specialGuests.userId}
              IS
              NULL
              THEN
              ${specialGuests.id}
              ELSE
              ${specialGuests.userId}
              END
          `.as("user_id"),
          username: sql<string>`
              CASE 
    WHEN
              ${specialGuests.telegram}
              IS
              NULL
              THEN
              CONCAT
              (
              'VIP',
              TRIM
              (
              CAST
              (
              ${specialGuests.id}
              AS
              TEXT
              )
              )
              )
              ELSE
              REPLACE
              (
              TRIM
              (
              ${specialGuests.telegram}
              ),
              '@',
              ''
              )
              END
          `.as("username"),
          first_name: specialGuests.name,
          last_name: sql<string>`COALESCE
              (${specialGuests.surname}, '')`.as("last_name"),
          wallet_address: sql`null`.as("wallet_address"),
          created_at: sql`NOW
              ()`.as("created_at"),
          has_ticket: sql<boolean>`true`.as("has_ticket"),
          ticket_status: specialGuests.type,
          ticket_id: sql<number>`null`.as("ticket_id"),
          ticket_order_id: sql<string>`
              CONCAT
              ( LEFT(md5(CAST (${specialGuests.id} AS TEXT)), 8), '-',
                  LEFT (md5(CAST (${specialGuests.id} AS TEXT)), 4), '-',
                  LEFT (md5(CAST (${specialGuests.id} AS TEXT)), 4), '-',
                  LEFT (md5(CAST (${specialGuests.id} AS TEXT)), 4), '-',
                  LEFT (md5(CAST (${specialGuests.id} AS TEXT)), 12))
          `.as("ticket_order_id"),
          ticket_qr_code: sql`null`.as("ticket_qr_code"),
          ticket_position: sql`COALESCE
              (${specialGuests.position}, '')`.as("ticket_position"),
          ticket_company: sql`COALESCE
              (${specialGuests.company}, '')`.as("ticket_position"),
          ticket_nft_address: sql`null`.as("ticket_nft_address"),
          ticket_created_at: sql`NOW
              ()`.as("ticket_created_at"),
          badge_info: sql<string>`
              CASE 
              WHEN
              ${specialGuests.telegram}
              IS
              NULL
              THEN
              'https://t.me/theontonbot'
              ELSE
              CONCAT
              (
              'https://t.me/',
              REPLACE
              (
              ${specialGuests.telegram},
              '@',
              ''
              )
              )
              END
          `.as("badge"),
        })
        .from(specialGuests)
        .where(
          and(
            eq(specialGuests.eventUuid, event_uuid), // Adding event_uuid condition
            search
              ? or(
                  ilike(specialGuests.telegram, `%${search}%`),
                  ilike(specialGuests.name, `%${search}%`),
                  ilike(specialGuests.surname, `%${search}%`)
                )
              : sql`true`
          )
        )
        .execute();

      visitorsData = [...specialGuestQueryData, ...ticketDataResults];
    } else {
      visitorsData = ticketDataResults;
    }
    // logger.log(ticketDataResults);
  }

  const moreRecordsAvailable = typeof limit === "number" ? visitorsData.length === limit : false;
  const nextCursor = moreRecordsAvailable && true ? cursor + limit! : null;
  if (!dynamic_fields) {
    return {
      visitorsWithDynamicFields: null,
      moreRecordsAvailable,
      visitorsData,
      nextCursor,
    };
  }
  let userEventFieldsData = await db
    .select({
      user_id: userEventFields.user_id,
      event_field_id: userEventFields.event_field_id,
      data: userEventFields.data,
      title: eventFields.title,
    })
    .from(userEventFields)
    .leftJoin(eventFields, eq(userEventFields.event_field_id, eventFields.id))
    .leftJoin(events, eq(eventFields.event_id, events.event_id))
    .where(eq(events.event_uuid, event_uuid));

  const visitorsWithDynamicFields = visitorsData.map((visitor) => {
    const dynamicFields = userEventFieldsData
      .filter((field) => field.user_id === visitor.user_id)
      .map((field) => ({
        event_field_id: field.event_field_id,
        data: field.data,
      }));

    return {
      ...visitor,
      dynamicFields,
    };
  });

  return {
    visitorsWithDynamicFields,
    moreRecordsAvailable,
    visitorsData,
    nextCursor,
  };
};

export const updateVisitorLastVisit = async (id: number) => {
  return db
    .update(visitors)
    .set({
      last_visit: sql`now
          ()`,
      updatedBy: "system",
    })
    .where(eq(visitors.id, id));
};

// Function to get visitor by user_id and event_uuid
export const getVisitor = async (user_id: number, event_uuid: string): Promise<VisitorsRow | undefined> => {
  return await findVisitorByUserAndEvent(user_id, event_uuid);
};
// Function to add a new visitor
export const addVisitor = async (user_id: number, event_uuid: string): Promise<VisitorsRow | undefined> => {
  try {
    const existingVisitor = await getVisitor(user_id, event_uuid);
    if (existingVisitor) {
      return existingVisitor; // Visitor already exists, no need to add
    }
    // Clear the organizer user cache so it will be reloaded next time
    await redisTools.deleteCache(getUserCacheKey(user_id));
    // Insert new visitor
    return await insertNewVisitor(user_id, event_uuid);
  } catch (error) {
    logger.error("Error adding visitor:", error);
    throw new Error("Failed to add visitor.");
  }
};

export const selectVisitorsWithWalletAddress = async (event_uuid: string) => {
  return await db
    .select()
    .from(visitors)
    .fullJoin(users, eq(visitors.user_id, users.user_id))
    .where(and(eq(visitors.event_uuid, event_uuid), isNotNull(users.wallet_address)))
    .execute();
};

export const findVisitorByUserAndEventUuid = async (
  user_id: number,
  event_uuid: string
): Promise<VisitorsRow | undefined> => {
  const cacheKey = getVisitorCacheKey(user_id, event_uuid);
  const cachedVisitor = await redisTools.getCache(cacheKey);

  if (cachedVisitor) {
    // logger.log("Cache hit for:", cacheKey);
    return JSON.parse(cachedVisitor) as VisitorsRow;
  }

  const visitor = await db.query.visitors.findFirst({
    where(fields, { eq, and }) {
      return and(eq(fields.user_id, user_id), eq(fields.event_uuid, event_uuid));
    },
  });

  // Cache the result if it exists
  if (visitor) {
    await redisTools.setCache(cacheKey, JSON.stringify(visitor), redisTools.cacheLvl.long);
  }

  return visitor;
};

export const findVisitorById = async (visitor_id: number) => {
  return db.query.visitors.findFirst({
    where: (fields, { eq }) => {
      return eq(fields.id, visitor_id);
    },
  });
};

export const visitorsDB = {
  findVisitorByUserAndEvent,
  findVisitorByUserAndEventUuid,
  findVisitorById,
  selectVisitorsByEventUuid,
  selectVisitorsByEventUuidMock,
  selectValidVisitorById,
  selectVisitorsWithWalletAddress,
  updateVisitorLastVisit,
  getVisitor,
  addVisitor,
};
export default visitorsDB;
