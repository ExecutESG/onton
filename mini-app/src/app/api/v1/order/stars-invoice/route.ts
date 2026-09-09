import { db } from "@/db/db";
import { events, eventTokens, orders } from "@/db/schema";
import { getAuthenticatedUser } from "@/server/auth";
import { callCreateStarsInvoiceLink } from "@/lib/tgBot";
import { eq } from "drizzle-orm";
import { z } from "zod";

const starsInvoiceSchema = z.object({
  order_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const [userId, unauthorized] = getAuthenticatedUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const rawBody = await req.json();
    const parsed = starsInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { order_id } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.uuid, order_id),
    });

    if (!order) {
      return Response.json({ error: "order_not_found" }, { status: 404 });
    }

    if (order.user_id !== userId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    if (order.state === "completed") {
      return Response.json({ error: "order_already_completed", message: "Ticket already purchased" }, { status: 400 });
    }

    const event = await db.query.events.findFirst({
      where: eq(events.event_uuid, order.event_uuid!),
    });

    if (!event) {
      return Response.json({ error: "event_not_found" }, { status: 404 });
    }

    const token = await db.query.eventTokens.findFirst({
      where: eq(eventTokens.token_id, order.token_id),
    });

    const price = order.total_price;
    // Conversion to Stars:
    // If STAR: 1:1
    // If USDT: 1 USDT ≈ 50 Stars (Telegram Stars peg standard: ~1 Star = $0.02)
    // If TON: 1 TON ≈ 150 Stars (approx $3/TON peg)
    let starsAmount = Math.ceil(price);
    if (token?.symbol === "USDT") {
      starsAmount = Math.max(1, Math.ceil(price * 50));
    } else if (token?.symbol === "TON") {
      starsAmount = Math.max(1, Math.ceil(price * 150));
    } else if (token?.symbol === "STAR") {
      starsAmount = Math.max(1, Math.ceil(price));
    } else {
      starsAmount = Math.max(1, Math.ceil(price * 50));
    }

    const title = (event.title || "Event Ticket").slice(0, 30);
    const description = `Admission ticket for ${event.title || "event"}`.slice(0, 250);

    const invoiceResult = await callCreateStarsInvoiceLink({
      title,
      description,
      payload: order.uuid,
      starsAmount,
    });

    if (!invoiceResult.success || !invoiceResult.link) {
      return Response.json(
        { error: "invoice_creation_failed", details: invoiceResult.error || "Could not generate Stars invoice" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      invoice_link: invoiceResult.link,
      stars_amount: starsAmount,
      order_id: order.uuid,
    });
  } catch (error: any) {
    return Response.json({ error: "internal_error", details: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
