import { db } from "@/db/db";
import { apiKeyAuthentication, getAuthenticatedUser } from "@/server/auth";
import { NextRequest } from "next/server";
import "@/lib/gracefullyShutdown";
import { config } from "@/server/config";

type OptionsProps = {
  params: {
    order_id: string;
  };
};

export async function GET(req: NextRequest, { params }: OptionsProps) {
  const orderId = params.order_id;

  const [, error] = getAuthenticatedUser(req);
  const apiKeyError = apiKeyAuthentication(req);
  if (error && apiKeyError) return error || apiKeyError;

  const order = await db.query.orders.findFirst({
    where(fields, { eq }) {
      return eq(fields.uuid, orderId);
    },
  });

  if (!order) {
    return Response.json({ message: "order_not_found" }, { status: 404 });
  }
  if (!order.event_uuid) {
    return Response.json({ message: "order_does_not_have_event_uuid" }, { status: 400 });
  }

  const tickets = await db.query.tickets.findMany({
    where(fields, { eq }) {
      return eq(fields.order_uuid, order.uuid);
    },
  });

  // get event ticket and if not found return event ticket not found
  const eventPaymentInfo = await db.query.eventPayment.findFirst({
    where(fields, { eq }) {
      return eq(fields.event_uuid, order.event_uuid!);
    },
  });

  if (!eventPaymentInfo) return Response.json({ message: "event_ticket_not_found" }, { status: 404 });

  let tier = null;
  if (order.tier_id) {
    tier = await db.query.eventTicketTiers.findFirst({
      where(fields, { eq }) {
        return eq(fields.id, order.tier_id!);
      },
    });
  }

  return Response.json({
    ...order,
    platform_fee_raw: order.platform_fee_raw != null ? order.platform_fee_raw.toString() : null,
    organizer_amount_raw: order.organizer_amount_raw != null ? order.organizer_amount_raw.toString() : null,
    total_price: order.total_price,
    recipient_address: eventPaymentInfo.recipient_address || config?.ONTON_WALLET_ADDRESS || null,
    nft_collection_address: eventPaymentInfo.collectionAddress,
    tier,
    tickets,
  });
}

export const dynamic = "force-dynamic";
