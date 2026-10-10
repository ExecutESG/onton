import { verifyBotHmac } from "@/server/botHmacAuth";
import { notifyOrganizerAndAdminOnTicketPayment } from "@/services/orderNotificationService";
import { z } from "zod";

export const runtime = "nodejs";

const notifyOrganizerSchema = z.object({
  orderUuid: z.string(),
  eventUuid: z.string().uuid(),
  buyerUserId: z.number().int(),
  buyerName: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().default("STARS"),
  ticketTierName: z.string().optional().nullable(),
  tierId: z.number().int().optional().nullable(),
  feeBps: z.number().int().optional().nullable(),
});

export async function POST(request: Request) {
  // 1. Authenticate via HMAC
  const authResponse = await verifyBotHmac(request);
  if (authResponse) {
    return authResponse;
  }

  const rawBody = await request.text();

  // 2. Parse & Validate request body
  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: "bad_request", message: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  const parsed = notifyOrganizerSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return Response.json(
      {
        error: "validation_error",
        message: "Invalid notification parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const result = await notifyOrganizerAndAdminOnTicketPayment({
    orderUuid: parsed.data.orderUuid,
    eventUuid: parsed.data.eventUuid,
    buyerUserId: parsed.data.buyerUserId,
    buyerName: parsed.data.buyerName,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    ticketTierName: parsed.data.ticketTierName,
    tierId: parsed.data.tierId,
    feeBps: parsed.data.feeBps,
  });

  return Response.json(result, { status: 200 });
}
