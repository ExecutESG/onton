import { db } from "@/db/db";
import { TicketStatus } from "@/db/enum";
import { eventRegistrants, orders, tickets } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

// Exporting the functions as part of ticketDB
const ticketDB = {
  getTicketByUuid,
  checkInTicket,
};

export default ticketDB;
