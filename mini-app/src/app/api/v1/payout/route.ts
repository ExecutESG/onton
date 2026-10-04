import { db } from "@/db/db";
import { events, eventPayment, organizerPayouts } from "@/db/schema";
import { verifyBotHmac } from "@/server/botHmacAuth";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const payoutSchema = z.object({
  event_uuid: z.string().uuid({ message: "Invalid event_uuid format" }),
  amount: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        return /^\d{1,11}(\.\d{1,9})?$/.test(String(val));
      },
      { message: "Amount must be a positive number up to 11 digits and 9 decimals" }
    )
    .transform((val) => String(val)),
  tx_hash: z.string().refine((val) => {
    return /^[A-Fa-f0-9]{64}$/.test(val) || /^[A-Za-z0-9_-]{43}=?$/.test(val);
  }, { message: "Invalid transaction hash format" }).transform((val) => val.slice(0, 100)),
  paid_by: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && Number.isInteger(num);
      },
      { message: "paid_by must be a valid integer" }
    )
    .transform((val) => Number(val)),
  token_id: z.number().int().optional(),
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

  const parsed = payoutSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return Response.json(
      {
        error: "validation_error",
        message: "Invalid payout parameters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { event_uuid, amount, tx_hash, paid_by, token_id } = parsed.data;

  // 3. Verify event exists
  const existingEvent = await db.query.events.findFirst({
    where: eq(events.event_uuid, event_uuid),
  });
  if (!existingEvent) {
    return Response.json(
      { error: "not_found", message: `Event not found: ${event_uuid}` },
      { status: 404 }
    );
  }

  if (!existingEvent.has_payment) {
    return Response.json(
      { error: "bad_request", message: "Event does not require payment" },
      { status: 400 }
    );
  }

  // 4. Verify event payment info exists
  const paymentInfo = await db.query.eventPayment.findFirst({
    where: eq(eventPayment.event_uuid, event_uuid),
  });
  if (!paymentInfo) {
    return Response.json(
      { error: "not_found", message: `Payment info not found for event: ${event_uuid}` },
      { status: 404 }
    );
  }

  const finalTokenId = token_id ?? paymentInfo.token_id ?? null;

  // 5. Atomic transaction: insert organizer payout ledger & flip status to payed_to_organizer
  const payout = await db.transaction(async (trx) => {
    const [inserted] = await trx
      .insert(organizerPayouts)
      .values({
        event_uuid,
        amount,
        token_id: finalTokenId,
        tx_hash,
        paid_by,
        paid_at: new Date(),
      })
      .onConflictDoNothing({ target: organizerPayouts.tx_hash })
      .returning();

    if (!inserted) {
      return null;
    }

    await trx
      .update(eventPayment)
      .set({
        organizer_payment_status: "payed_to_organizer",
        updatedAt: new Date(),
        updatedBy: `payout_bot_${paid_by}`,
      })
      .where(eq(eventPayment.event_uuid, event_uuid));

    return inserted;
  });

  if (!payout) {
    return Response.json({ error: "duplicate_tx", message: "Duplicate transaction hash" }, { status: 409 });
  }

  return Response.json(
    {
      success: true,
      message: "Payout recorded successfully",
      payout,
    },
    { status: 200 }
  );
}
