import { db } from "@/db/db";
import { TicketStatus } from "@/db/enum";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";

// Function to get a ticket by its UUID
const getTicketByUuid = async (ticketUuid: string) => {
  const ticket = await db.select().from(tickets).where(eq(tickets.order_uuid, ticketUuid)).limit(1).execute();

  return ticket.length > 0 ? ticket[0] : null;
};

type CheckInTicketResult = { status: TicketStatus | null } | { alreadyCheckedIn: boolean };

// Function to check in a ticket (update its status to "USED")
export const checkInTicket = async (ticketUuid: string): Promise<CheckInTicketResult | null> => {
  // First, fetch the current status of the ticket
  const ticket = await db
    .select({
      status: tickets.status,
      order_uuid: tickets.order_uuid,
      id: tickets.id,
      user_id: tickets.user_id,
      telegram_username: tickets.telegram,
    })
    .from(tickets)
    .where(eq(tickets.order_uuid, ticketUuid))
    .limit(1)
    .execute();

  if (ticket.length === 0) {
    return null;
  }

  if (ticket[0].status === "USED") {
    return { alreadyCheckedIn: true };
  }

  const result = await db
    .update(tickets)
    .set({
      status: "USED" as TicketStatus,
      updatedAt: new Date(),
      updatedBy: "system_check-in",
    })
    .where(eq(tickets.order_uuid, ticketUuid))
    .returning({ status: tickets.status })
    .execute();

  return result.length > 0 ? ticket[0] : null;
};

// Exporting the functions as part of ticketDB
const ticketDB = {
  getTicketByUuid,
  checkInTicket,
};

export default ticketDB;
