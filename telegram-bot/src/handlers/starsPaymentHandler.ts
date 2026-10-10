import { InlineKeyboard } from "grammy";
import { MyContext } from "../types/MyContext";
import { pool } from "../db/pool";
import { logger } from "../utils/logger";

/**
 * Safely parse invoice_payload which could be:
 * 1) A plain UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 * 2) A JSON string (e.g. '{"order_uuid":"..."}' or '{"order_id":"..."}')
 */
export function parseInvoicePayload(payload: string): { orderUuid: string | null } {
  if (!payload || typeof payload !== "string") {
    return { orderUuid: null };
  }
  const trimmed = payload.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const uuid = parsed.order_uuid || parsed.order_id || parsed.orderId || parsed.uuid;
      if (typeof uuid === "string" && isValidUuid(uuid)) {
        return { orderUuid: uuid };
      }
    } catch {
      // not valid JSON, fall through
    }
  }
  if (isValidUuid(trimmed)) {
    return { orderUuid: trimmed };
  }
  return { orderUuid: null };
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Calculate expected Stars amount based on price and token symbol,
 * matching mini-app logic in /api/v1/order/stars-invoice.
 */
export function calculateExpectedStars(price: number, tokenSymbol?: string | null): number {
  if (tokenSymbol === "USDT") {
    return Math.max(1, Math.ceil(price * 50));
  } else if (tokenSymbol === "TON") {
    return Math.max(1, Math.ceil(price * 150));
  } else if (tokenSymbol === "STAR") {
    return Math.max(1, Math.ceil(price));
  } else {
    return Math.max(1, Math.ceil(price * 50));
  }
}

/**
 * Handle Telegram Stars pre-checkout query (must be answered within 10 seconds)
 * Validates order existence, state, tier capacity, and expected price before approval.
 */
export async function handleStarsPreCheckout(ctx: MyContext) {
  const query = ctx.preCheckoutQuery;
  if (!query) return;

  const rawPayload = query.invoice_payload;
  const { orderUuid } = parseInvoicePayload(rawPayload);

  if (!orderUuid) {
    logger.warn(`Stars pre_checkout_query rejected: invalid payload format "${rawPayload}"`);
    await ctx.answerPreCheckoutQuery(false, {
      error_message: "Invalid ticket order. Please restart the checkout from the event page.",
    });
    return;
  }

  try {
    // 1) Fetch order, tier, event, and token details
    const orderRes = await pool.query(
      `SELECT 
         o.uuid, 
         o.state, 
         o.total_price, 
         o.user_id, 
         o.event_uuid, 
         o.tier_id,
         ett.capacity AS tier_capacity, 
         ett.sold_count AS tier_sold_count, 
         ett.tier_name,
         e.capacity AS event_capacity,
         e.title AS event_title,
         t.symbol AS token_symbol
       FROM orders o
       LEFT JOIN event_ticket_tiers ett ON o.tier_id = ett.id
       LEFT JOIN events e ON o.event_uuid = e.event_uuid
       LEFT JOIN event_tokens t ON o.token_id = t.token_id
       WHERE o.uuid = $1`,
      [orderUuid]
    );

    if (orderRes.rowCount === 0) {
      logger.warn(`Stars pre_checkout_query rejected: order not found ${orderUuid}`);
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Order not found. Please create a new ticket order.",
      });
      return;
    }

    const order = orderRes.rows[0];

    // 2) Check order state
    if (order.state === "completed") {
      logger.warn(`Stars pre_checkout_query rejected: order ${orderUuid} already completed`);
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "This order has already been paid and processed.",
      });
      return;
    }

    if (order.state !== "new" && order.state !== "confirming") {
      logger.warn(`Stars pre_checkout_query rejected: order ${orderUuid} in state '${order.state}'`);
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "This order is no longer valid. Please start a new purchase.",
      });
      return;
    }

    // 3) Check tier capacity (sold_count < capacity)
    if (order.tier_id && order.tier_capacity !== null && order.tier_capacity > 0) {
      if (order.tier_sold_count >= order.tier_capacity) {
        logger.warn(
          `Stars pre_checkout_query rejected: tier ${order.tier_id} (${order.tier_name}) sold out (${order.tier_sold_count}/${order.tier_capacity})`
        );
        await ctx.answerPreCheckoutQuery(false, {
          error_message: `The "${order.tier_name || "selected"}" ticket tier is sold out.`,
        });
        return;
      }
    }

    // 4) Check overall event capacity if set
    if (order.event_capacity !== null && order.event_capacity > 0) {
      const soldRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM orders 
         WHERE event_uuid = $1 AND state IN ('completed', 'processing')`,
        [order.event_uuid]
      );
      const soldTotal = soldRes.rows[0]?.cnt || 0;
      if (soldTotal >= order.event_capacity) {
        logger.warn(
          `Stars pre_checkout_query rejected: event ${order.event_uuid} reached capacity (${soldTotal}/${order.event_capacity})`
        );
        await ctx.answerPreCheckoutQuery(false, {
          error_message: "This event has reached full capacity.",
        });
        return;
      }
    }

    // 5) Check Stars price validation
    const expectedStars = calculateExpectedStars(Number(order.total_price), order.token_symbol);
    if (query.total_amount < expectedStars) {
      logger.warn(
        `Stars pre_checkout_query rejected: amount mismatch for order ${orderUuid}. Received: ${query.total_amount}, Expected: ${expectedStars}`
      );
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Payment amount does not match ticket price.",
      });
      return;
    }

    // All checks passed -> approve
    await ctx.answerPreCheckoutQuery(true);
    logger.log(`Approved pre_checkout_query for order ${orderUuid} from user ${ctx.from?.id}`);
  } catch (error) {
    logger.error(`Error in handleStarsPreCheckout for order ${orderUuid}:`, error);
    try {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Payment validation failed. Please try again.",
      });
    } catch (e) {
      logger.error("Failed to reject pre_checkout_query:", e);
    }
  }
}

/**
 * Handle successful payment in Telegram Stars
 */
export async function handleStarsSuccessfulPayment(ctx: MyContext) {
  const payment = ctx.message?.successful_payment;
  if (!payment) return;

  const rawPayload = payment.invoice_payload;
  const { orderUuid } = parseInvoicePayload(rawPayload);
  const orderId = orderUuid || rawPayload;
  const chargeId = payment.telegram_payment_charge_id;
  const starsPaid = payment.total_amount;
  const userId = ctx.from?.id;

  logger.log(`Stars payment successful for order ${orderId}, chargeId=${chargeId}, stars=${starsPaid}, user=${userId}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Update order state to completed
    const orderRes = await client.query(
      `UPDATE orders
       SET state = 'completed',
           trx_hash = $1,
           updated_at = NOW(),
           updated_by = 'stars_payment'
       WHERE uuid = $2
       RETURNING *`,
      [chargeId, orderId]
    );

    if (orderRes.rowCount === 0) {
      logger.warn(`No order found for uuid ${orderId} in Stars payment`);
      await client.query("ROLLBACK");
      return;
    }

    const order = orderRes.rows[0];
    const eventUuid = order.event_uuid;
    const buyerUserId = order.user_id || userId;

    // 1b) Increment sold_count on event_ticket_tiers atomically
    if (order.tier_id) {
      await client.query(
        `UPDATE event_ticket_tiers
         SET sold_count = sold_count + 1,
             updated_at = NOW(),
             updated_by = 'stars_payment'
         WHERE id = $1`,
        [order.tier_id]
      );
    }

    // 2) Update event_registrants to approved
    const regRes = await client.query(
      `UPDATE event_registrants
       SET status = 'approved',
           updated_at = NOW(),
           updated_by = 'stars_payment'
       WHERE event_uuid = $1 AND user_id = $2
       RETURNING id, registrant_uuid, register_info`,
      [eventUuid, buyerUserId]
    );

    let registrantId: number | null = null;
    let registerInfo: any = {};

    if (regRes.rowCount && regRes.rowCount > 0) {
      registrantId = regRes.rows[0].id;
      registerInfo = regRes.rows[0].register_info || {};
    }

    // 3) Insert tickets record if missing
    const ticketCheck = await client.query(
      `SELECT id FROM tickets WHERE order_uuid = $1`,
      [orderId]
    );

    if (ticketCheck.rowCount === 0) {
      const payInfoRes = await client.query(
        `SELECT id FROM event_payment_info WHERE event_uuid = $1 LIMIT 1`,
        [eventUuid]
      );
      const ticketId = payInfoRes.rows[0]?.id || 1;

      await client.query(
        `INSERT INTO tickets (name, telegram, company, position, order_uuid, status, event_uuid, event_ticket_id, user_id, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'UNUSED', $6, $7, $8, 'stars_payment', NOW())
         ON CONFLICT DO NOTHING`,
        [
          registerInfo.full_name || ctx.from?.first_name || "",
          registerInfo.telegram || ctx.from?.username || "",
          registerInfo.company || "",
          registerInfo.position || "",
          orderId,
          eventUuid,
          ticketId,
          buyerUserId,
        ]
      );
    }

    // 4) Check if event has a telegram group and generate single-use invite link
    const eventRes = await client.query(
      `SELECT title, event_telegram_group FROM events WHERE event_uuid = $1`,
      [eventUuid]
    );
    const event = eventRes.rows[0];

    await client.query("COMMIT");

    let inviteLink: string | null = null;
    if (event?.event_telegram_group && registrantId) {
      try {
        const linkResult = await ctx.api.createChatInviteLink(event.event_telegram_group, {
          member_limit: 1,
          name: `Event_${eventUuid.slice(0, 8)}_User_${buyerUserId}`,
        });

        if (linkResult?.invite_link) {
          inviteLink = linkResult.invite_link;
          await pool.query(
            `UPDATE event_registrants SET telegram_invite_link = $1 WHERE id = $2`,
            [inviteLink, registrantId]
          );
        }
      } catch (err) {
        logger.warn(`Could not create invite link for group ${event.event_telegram_group}:`, err);
      }
    }

    // 5) Send confirmation message to user with button to view ticket
    const appBaseUrl = (
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      process.env.APP_BASE_URL ||
      "https://app.onton.live"
    ).replace(/\/$/, "");

    const ticketWebUrl = `${appBaseUrl}/tickets/${eventUuid}`;

    const replyText =
      `🎉 <b>Payment Received! (${starsPaid} Stars)</b>\n\n` +
      `Your ticket for <b>${event?.title || "the event"}</b> has been issued!\n` +
      (inviteLink
        ? `\n🔗 <b>Private Chat Invite:</b>\n${inviteLink}\n<i>(One-time use, keep private)</i>\n`
        : "") +
      `\nTap the button below to view your ticket and QR check-in code.`;

    const keyboard = new InlineKeyboard().webApp("🎟 View My Ticket", ticketWebUrl);

    if (inviteLink) {
      keyboard.row().url("💬 Join Event Chat", inviteLink);
    }

    await ctx.reply(replyText, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error handling Stars successful payment:", error);
  } finally {
    client.release();
  }
}
