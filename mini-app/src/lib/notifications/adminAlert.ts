import { db } from "@/db/db";
import { orderDlq } from "@/db/schema";
import { sendTelegramMessage } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";
import { MAIN_TG_CHAT_ID } from "@/constants";

export interface OversellAlertParams {
  orderUuid: string;
  eventUuid?: string;
  trxHash?: string | null;
  paymentMethod?: string;
  reason: string;
}

/**
 * Handles the DLQ and alert dispatch when a paid order cannot be fulfilled due to oversell (#1055).
 * Guarantees idempotency: each oversell event produces exactly one DLQ record and one alert.
 */
export async function sendOversellAdminAlert(params: OversellAlertParams): Promise<boolean> {
  try {
    // 1. Insert into order_dlq idempotently (unique index on order_uuid)
    const inserted = await db
      .insert(orderDlq)
      .values({
        order_uuid: params.orderUuid,
        error_reason: params.reason,
        trx_hash: params.trxHash || null,
      })
      .onConflictDoNothing()
      .returning({ id: orderDlq.id })
      .execute();

    if (inserted.length === 0) {
      logger.info(`[Oversell Alert] Order ${params.orderUuid} already in order_dlq; skipping duplicate alert.`);
      return false;
    }

    logger.warn(`[Oversell Alert] Order ${params.orderUuid} inserted into order_dlq with reason: ${params.reason}`);

    // 2. Dispatch admin alert via Telegram notification channel helper
    const adminChatId = process.env.ADMIN_ALERT_CHAT_ID || MAIN_TG_CHAT_ID;
    const message = [
      `🚨 <b>[OVERSELL ALERT - MANUAL REFUND REQUIRED]</b>`,
      ``,
      `<b>Order ID:</b> <code>${params.orderUuid}</code>`,
      `<b>Reason:</b> <code>${params.reason}</code>`,
      params.eventUuid ? `<b>Event UUID:</b> <code>${params.eventUuid}</code>` : "",
      params.trxHash ? `<b>Transaction:</b> <code>${params.trxHash}</code>` : "",
      params.paymentMethod ? `<b>Payment Method:</b> ${params.paymentMethod}` : "",
      ``,
      `<i>Action required: Customer payment confirmed after tier/event capacity was exhausted. Inventory was not issued. Please issue manual refund.</i>`,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTelegramMessage({
      chat_id: adminChatId,
      message,
    });

    return true;
  } catch (error) {
    logger.error(`[Oversell Alert] Failed to dispatch admin alert for order ${params.orderUuid}:`, error);
    return false;
  }
}
