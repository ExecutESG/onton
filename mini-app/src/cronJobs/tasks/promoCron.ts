// src/server/cron/promoCron.ts
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db/db";
import { coupon_items, coupon_definition, events } from "@/db/schema";
import { logger } from "@/server/utils/logger";
import { sendTelegramMessage } from "@/lib/tgBot";
import { sleep } from "@/utils";

/* ------------------------------------------------------------------ */
/* 1) Row type returned from the SELECT                               */
/* ------------------------------------------------------------------ */
interface PromoRow {
  itemId: number;
  telegramUserId: number;
  code: string;
  discountValue: number; // percent
  eventUuid: string;
  sendAttempts: number;
  eventTitle: string; // optional, for logging
  discountType: "percent" | "fixed"; // percent or fixed
}

/* ------------------------------------------------------------------ */
/* 2) Fetch rows that still need a DM                                 */
/* ------------------------------------------------------------------ */
export async function getPromoCodesNeedingDM(): Promise<PromoRow[]> {
  const rows = await db
    .select({
      itemId: coupon_items.id,
      telegramUserId: coupon_items.invited_user_id, // bigint → ts number via mode:"number"
      code: coupon_items.code,
      discountValue: coupon_definition.value,
      discountType: coupon_definition.cpd_type, // percent or fixed
      eventUuid: coupon_items.event_uuid,
      sendAttempts: coupon_items.send_attempts,
      eventTitle: events.title,
    })
    .from(coupon_items)
    .innerJoin(coupon_definition, eq(coupon_items.coupon_definition_id, coupon_definition.id))
    .innerJoin(events, eq(coupon_items.event_uuid, events.event_uuid))
    .where(
      and(
        isNotNull(coupon_items.invited_user_id),
        eq(coupon_items.message_status, "pending"),
        lt(coupon_items.send_attempts, 8) // haven’t exhausted 8 tries
      )
    )
    .limit(500); // safety: send at most 500 messages per cron tick

  // drizzle typed `invited_user_id` as number (because mode:"number")
  return rows as PromoRow[];
}

/* ------------------------------------------------------------------ */
/* 3) Single-row retry logic (≤ 8 total)                              */
/* ------------------------------------------------------------------ */
async function attemptSendPromoWithRetries(row: PromoRow): Promise<boolean> {
  const maxTries = 8 - row.sendAttempts; // e.g. already tried 3 → 5 left
  const messageText =
    `🎁 You’ve received a promotion code!\n\n` +
    `Event: <b>${row.eventTitle}</b>\n` +
    `Code: <code>${row.code}</code>\n` +
    `Discount: <b>${row.discountValue} ${row.discountType === "percent" ? "%" : ""}</b>\n\n` +
    `Redeem it when purchasing tickets for the event.`;

  let attempt = 0;
  while (attempt < maxTries) {
    attempt++;
    const globalAttemptNo = row.sendAttempts + attempt; // 1-8 total
    try {
      logger.info(`Promo DM • item ${row.itemId} • user ${row.telegramUserId} • attempt #${globalAttemptNo}`);

      const res = await sendTelegramMessage({
        chat_id: row.telegramUserId,
        message: messageText,
        linkText: "Check now",
        link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${row.eventUuid}`,
      });

      const now = new Date();

      if (res.success) {
        // success → mark sent & exit
        await db
          .update(coupon_items)
          .set({
            message_status: "sent",
            send_attempts: globalAttemptNo,
            last_send_at: now,
            last_send_error: null,
          })
          .where(eq(coupon_items.id, row.itemId));

        logger.info(`Promo DM success for item ${row.itemId}`);
        return true;
      }

      // failed but API responded → record error and loop
      await db
        .update(coupon_items)
        .set({
          send_attempts: globalAttemptNo,
          last_send_at: now,
          last_send_error: res.error ?? "Unknown TG API error",
        })
        .where(eq(coupon_items.id, row.itemId));

      logger.warn(`Promo DM attempt #${globalAttemptNo} failed • ${res.error}`);
    } catch (err: any) {
      const now = new Date();
      await db
        .update(coupon_items)
        .set({
          send_attempts: row.sendAttempts + attempt,
          last_send_at: now,
          last_send_error: err.message ?? String(err),
        })
        .where(eq(coupon_items.id, row.itemId));

      logger.error(`Promo DM attempt #${row.sendAttempts + attempt} threw exception`, err);
    }

    if (row.sendAttempts + attempt >= 8) break; // out of tries
    await sleep(200);
  }

  // if we’re here → all allowed tries failed → mark failed
  await db.update(coupon_items).set({ message_status: "failed" }).where(eq(coupon_items.id, row.itemId));

  logger.error(`Promo DM permanently failed for item ${row.itemId}`);
  return false;
}

/* ------------------------------------------------------------------ */
/* 4) Main cron job entrypoint                                        */
/* ------------------------------------------------------------------ */
export async function sendPendingPromoCodes() {
  const pending = await getPromoCodesNeedingDM();
  if (!pending.length) {
    // logger.info("Promo cron: no pending codes to send.");
    return;
  }

  logger.info(`Promo cron: processing ${pending.length} coupon items…`);

  for (const row of pending) {
    // tiny spacing to avoid hitting TG flood limits
    await sleep(50);
    try {
      await attemptSendPromoWithRetries(row);
    } catch (err) {
      logger.error(`Promo cron: fatal error for item ${row.itemId}`, err);
    }
  }
}
