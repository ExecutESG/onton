import { db } from "@/db/db";
import { TicketStatus } from "@/db/enum";
import { eventPayment, eventRegistrants, events, nftItems, orders, rewards, tickets, visitors } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

// Function to get a ticket by its UUID (order_uuid, registrant_uuid, or order uuid)
const getTicketByUuid = async (ticketUuid: string) => {
  // 1) Direct lookup in tickets table
  const ticket = await db.select().from(tickets).where(eq(tickets.order_uuid, ticketUuid)).limit(1).execute();
  if (ticket.length > 0) {
    return ticket[0];
  }

  // 2) Fallback to eventRegistrants table by registrant_uuid
  const reg = await db
    .select()
    .from(eventRegistrants)
    .where(eq(eventRegistrants.registrant_uuid, ticketUuid))
    .limit(1)
    .execute();

  if (reg.length > 0) {
    const r = reg[0];
    const info = (typeof r.register_info === "object" ? r.register_info : JSON.parse(String(r.register_info || "{}"))) as Record<string, string | null>;
    return {
      id: r.id,
      name: info?.full_name || "",
      telegram: info?.telegram || "",
      company: info?.company || "",
      position: info?.position || "",
      order_uuid: r.registrant_uuid,
      status: (r.status === "checkedin" ? "USED" : "UNUSED") as TicketStatus,
      nftAddress: null,
      event_uuid: r.event_uuid,
      ticket_id: 0,
      user_id: r.user_id,
      created_at: r.created_at,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
    };
  }

  // 3) Fallback to orders table by order uuid
  const orderRow = await db.select().from(orders).where(eq(orders.uuid, ticketUuid)).limit(1).execute();
  if (orderRow.length > 0) {
    const o = orderRow[0];
    const regForOrder = await db
      .select()
      .from(eventRegistrants)
      .where(and(eq(eventRegistrants.event_uuid, o.event_uuid!), eq(eventRegistrants.user_id, o.user_id!)))
      .limit(1)
      .execute();

    if (regForOrder.length > 0) {
      const r = regForOrder[0];
      const info = (typeof r.register_info === "object" ? r.register_info : JSON.parse(String(r.register_info || "{}"))) as Record<string, string | null>;
      return {
        id: r.id,
        name: info?.full_name || "",
        telegram: info?.telegram || "",
        company: info?.company || "",
        position: info?.position || "",
        order_uuid: o.uuid,
        status: (r.status === "checkedin" ? "USED" : "UNUSED") as TicketStatus,
        nftAddress: null,
        event_uuid: o.event_uuid,
        ticket_id: 0,
        user_id: o.user_id,
        created_at: o.created_at,
        updatedAt: o.updatedAt,
        updatedBy: o.updatedBy,
      };
    }
  }

  return null;
};

type CheckInTicketResult = { status: TicketStatus | null } | { alreadyCheckedIn: boolean };

// Function to check in a ticket (update its status to "USED" and registrant to "checkedin")
export const checkInTicket = async (ticketUuid: string): Promise<CheckInTicketResult | null> => {
  // First, check tickets table
  const ticket = await db
    .select({
      status: tickets.status,
      order_uuid: tickets.order_uuid,
      id: tickets.id,
      user_id: tickets.user_id,
      telegram_username: tickets.telegram,
      event_uuid: tickets.event_uuid,
    })
    .from(tickets)
    .where(eq(tickets.order_uuid, ticketUuid))
    .limit(1)
    .execute();

  if (ticket.length > 0) {
    if (ticket[0].status === "USED") {
      return { alreadyCheckedIn: true };
    }

    await db
      .update(tickets)
      .set({
        status: "USED" as TicketStatus,
        updatedAt: new Date(),
        updatedBy: "system_check-in",
      })
      .where(eq(tickets.order_uuid, ticketUuid))
      .execute();

    if (ticket[0].user_id && ticket[0].event_uuid) {
      await db
        .update(eventRegistrants)
        .set({ status: "checkedin", updatedAt: new Date() })
        .where(
          and(
            eq(eventRegistrants.event_uuid, ticket[0].event_uuid),
            eq(eventRegistrants.user_id, ticket[0].user_id)
          )
        )
        .execute();
    }

    return ticket[0];
  }

  // Second, check eventRegistrants by registrant_uuid
  const reg = await db
    .select()
    .from(eventRegistrants)
    .where(eq(eventRegistrants.registrant_uuid, ticketUuid))
    .limit(1)
    .execute();

  if (reg.length > 0) {
    const r = reg[0];
    if (r.status === "checkedin") {
      return { alreadyCheckedIn: true };
    }

    await db
      .update(eventRegistrants)
      .set({ status: "checkedin", updatedAt: new Date(), updatedBy: "system_check-in" })
      .where(eq(eventRegistrants.registrant_uuid, ticketUuid))
      .execute();

    // Also update tickets table if present
    await db
      .update(tickets)
      .set({ status: "USED" as TicketStatus, updatedAt: new Date(), updatedBy: "system_check-in" })
      .where(and(eq(tickets.event_uuid, r.event_uuid), eq(tickets.user_id, r.user_id)))
      .execute();

    const info = (typeof r.register_info === "object" ? r.register_info : JSON.parse(String(r.register_info || "{}"))) as Record<string, string | null>;
    return {
      status: "USED" as TicketStatus,
      order_uuid: r.registrant_uuid,
      id: r.id,
      user_id: r.user_id,
      telegram_username: info?.telegram || "",
    } as any;
  }

  // Third, check orders by uuid
  const ord = await db.select().from(orders).where(eq(orders.uuid, ticketUuid)).limit(1).execute();
  if (ord.length > 0 && ord[0].event_uuid && ord[0].user_id) {
    const o = ord[0];
    const regForOrder = await db
      .select()
      .from(eventRegistrants)
      .where(and(eq(eventRegistrants.event_uuid, o.event_uuid!), eq(eventRegistrants.user_id, o.user_id!)))
      .limit(1)
      .execute();

    if (regForOrder.length > 0) {
      const r = regForOrder[0];
      if (r.status === "checkedin") {
        return { alreadyCheckedIn: true };
      }

      await db
        .update(eventRegistrants)
        .set({ status: "checkedin", updatedAt: new Date(), updatedBy: "system_check-in" })
        .where(eq(eventRegistrants.id, r.id))
        .execute();

      await db
        .update(tickets)
        .set({ status: "USED" as TicketStatus, updatedAt: new Date(), updatedBy: "system_check-in" })
        .where(eq(tickets.order_uuid, o.uuid))
        .execute();

      const info = (typeof r.register_info === "object" ? r.register_info : JSON.parse(String(r.register_info || "{}"))) as Record<string, string | null>;
      return {
        status: "USED" as TicketStatus,
        order_uuid: o.uuid,
        id: r.id,
        user_id: r.user_id,
        telegram_username: info?.telegram || "",
      } as any;
    }
  }

  return null;
};

/**
 * Fetches ticket pass data for the attendee-facing ticket view.
 * Replaces the participant-tma HTTP loopback to /api/v1/event/:id/ticket
 * with a direct Drizzle ORM query.
 */
export const fetchTicketPassByEventUuid = async (eventUuid: string, userId: number) => {
  // 1. Get approved/checked-in registrant
  const registrant = await db
    .select()
    .from(eventRegistrants)
    .where(
      and(
        or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin")),
        eq(eventRegistrants.event_uuid, eventUuid),
        eq(eventRegistrants.user_id, userId)
      )
    )
    .limit(1)
    .execute();

  if (!registrant[0]) return null;

  const reg = registrant[0];
  const registerInfo = (typeof reg.register_info === "object"
    ? reg.register_info
    : JSON.parse(String(reg.register_info || "{}"))) as Record<string, string | null>;

  // 2. Get event payment/ticket info
  const paymentInfo = await db
    .select()
    .from(eventPayment)
    .where(eq(eventPayment.event_uuid, eventUuid))
    .limit(1)
    .execute();

  if (!paymentInfo[0]) return null;

  // 3. Get NFT address if exists
  const nft = await db
    .select({ nft_address: nftItems.nft_address })
    .from(nftItems)
    .where(and(eq(nftItems.event_uuid, eventUuid), eq(nftItems.owner, userId)))
    .limit(1)
    .execute();

  // 4. Get event data
  const event = await db
    .select({
      title: events.title,
      subtitle: events.subtitle,
      description: events.description,
      sbt_collection_address: events.sbt_collection_address,
    })
    .from(events)
    .where(eq(events.event_uuid, eventUuid))
    .limit(1)
    .execute();
  // 5. Get SBT reward if ticket type is TSCSBT
  let userSbtTicket: { data: { reward_link?: string } | null } | undefined;
  if (paymentInfo[0].ticket_type === "TSCSBT") {
    const visitor = await db
      .select({ id: visitors.id })
      .from(visitors)
      .where(and(eq(visitors.user_id, userId), eq(visitors.event_uuid, eventUuid)))
      .limit(1)
      .execute();

    if (visitor[0]) {
      const reward = await db
        .select({ data: rewards.data })
        .from(rewards)
        .where(and(eq(rewards.visitor_id, visitor[0].id), eq(rewards.type, "ton_society_csbt_ticket")))
        .limit(1)
        .execute();

      if (reward[0]) {
        userSbtTicket = { data: (reward[0].data as { reward_link?: string } | null) ?? null };
      }
    }
  }

  return {
    full_name: registerInfo?.full_name ?? "",
    telegram: registerInfo?.telegram ?? "",
    company: registerInfo?.company ?? null,
    position: registerInfo?.position ?? null,
    nftAddress: nft[0]?.nft_address ?? null,
    status: reg.status ?? "approved",
    orderUuid: reg.registrant_uuid,
    eventUuid,
    needsInfoUpdate: !registerInfo?.full_name,
    inviteLink: reg.telegram_invite_link ?? null,
    ticketData: {
      ticketImage: paymentInfo[0].ticketImage ?? "",
      eventTitle: event[0]?.title ?? "",
      eventSubtitle: event[0]?.subtitle ?? null,
      eventDescription: event[0]?.description ?? "",
      collectionAddress: event[0]?.sbt_collection_address ?? null,
    },
    userSbtTicket,
  };
};

// Exporting the functions as part of ticketDB
const ticketDB = {
  getTicketByUuid,
  checkInTicket,
  fetchTicketPassByEventUuid,
};

export default ticketDB;
