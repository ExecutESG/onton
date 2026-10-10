import { logger } from "@/server/utils/logger";
import { db } from "@/db/db";
import { eventPayment } from "@/db/schema/eventPayment";
import { eventTokens } from "@/db/schema/eventTokens";
import { events } from "@/db/schema/events";
import { and, count, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { orders } from "@/db/schema/orders";
import { nftItems } from "@/db/schema/nft_items";
import { sendLogNotification } from "@/lib/tgBot";
import { rounder, sleep } from "@/utils";

export const sendPaymentReminder = async () => {
  logger.log("sendPaymentReminder");
  const currentTimestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
  const oneDayInSeconds = 24 * 60 * 60;

  const events_need_of_remind = await db
    .select()
    .from(eventPayment)
    .innerJoin(events, eq(eventPayment.event_uuid, events.event_uuid))
    .innerJoin(eventTokens, eq(eventPayment.token_id, eventTokens.token_id))
    .where(
      and(
        eq(eventPayment.organizer_payment_status, "not_payed"),
        isNull(eventPayment.payout_reminder_sent_at),
        lt(events.end_date, currentTimestamp - oneDayInSeconds),
        isNotNull(eventPayment.collectionAddress)
      )
    )
    .execute();

  for (const event of events_need_of_remind) {
    const title = event.events.title;
    const recipient_address = event.event_payment_info.recipient_address;
    const paymentToken = event.event_tokens;
    const payment_type = paymentToken.symbol;
    const payment_type_emojis = paymentToken.is_native ? "🔹" : "💲";

    logger.log("event_payment_reminder", event.events.event_uuid);
    const totalAmount = await db
      .select({
        totalPrice: sql`SUM
            (${orders.total_price})`, // Calculates the sum of total_price
      })
      .from(orders)
      .where(
        and(
          isNotNull(orders.trx_hash), // Ensures trx_hash is not null
          eq(orders.event_uuid, event.events.event_uuid),
          or(eq(orders.order_type, "nft_mint"), eq(orders.order_type, "ts_csbt_ticket")),
          eq(orders.state, "completed")
        )
      )
      .execute();

    let payment_amount = 0;
    let commission = 0;
    let total = 0;
    if (totalAmount.length > 0 && totalAmount[0].totalPrice) {
      total = Number(totalAmount[0].totalPrice!);
      commission = total * 0.05; // The 5% Commission
      payment_amount = total - commission;
      logger.log("event_payment_reminder_total", total);
    }

    const total_amount_of_nft = await db
      .select({
        nft_count: count(), // Calculates the sum of total_price
      })
      .from(nftItems)
      .where(eq(nftItems.event_uuid, event.events.event_uuid))
      .execute();

    const nft_count: number = Number(total_amount_of_nft.pop()?.nft_count);

    const message_result = await sendLogNotification({
      message: `💵💵 Payment For Event
<b>${title}</b>
Total Sold : ${rounder(total, 2)}
Total Mints : ${nft_count}
🤑Commision : <code>${rounder(commission, 2)}</code>

Payment Type : <b>${payment_type}</b>${payment_type_emojis}
💰Organizer Payment : <code>${rounder(payment_amount, 2)}</code>
Recipient : <code>${recipient_address}</code>

@Mfarimani
@blackpred
`,
      topic: "payments",
    });

    if (message_result?.message_id) {
      // Successful Message send - record timestamp for idempotency without flipping organizer_payment_status
      await db
        .update(eventPayment)
        .set({ payout_reminder_sent_at: new Date() })
        .where(eq(eventPayment.id, event.event_payment_info.id))
        .execute();
    }

    await sleep(1000);
  }
};
