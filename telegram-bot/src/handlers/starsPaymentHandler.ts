import { InlineKeyboard } from "grammy";
import { MyContext } from "../types/MyContext";
import { pool } from "../db/pool";
import { logger } from "../utils/logger";
import { parseInvoicePayload, calculateExpectedStars } from "../helpers/starsUtils";
import { sendTopicMessage } from "../utils/logs-bot";
import { notifyOrganizerTicketSale } from "../utils/miniAppClient";

export { parseInvoicePayload, calculateExpectedStars };

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

    // 1c) Decrement organizer's fee_waiver_tickets_remaining if order completed with waiver
    if (order.fee_bps === 0 && Number(order.total_price) > 0) {
      await client.query(
        `UPDATE users
         SET fee_waiver_tickets_remaining = GREATEST(0, fee_waiver_tickets_remaining - 1),
             updated_at = NOW(),
             updated_by = 'stars_payment'
         FROM events
         WHERE events.event_uuid = $1
           AND users.user_id = events.owner
           AND users.fee_waiver_tickets_remaining > 0`,
        [eventUuid]
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

    const isFirstTicketFulfillment = ticketCheck.rowCount === 0;

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

    // 4b) Once-only notification to organizer and internal tickets_topic (deduplicated by ticket row insertion)
    if (isFirstTicketFulfillment) {
      let ticketTierName: string | null = null;
      if (order.tier_id) {
        try {
          const tierRes = await pool.query(
            `SELECT name FROM event_ticket_tiers WHERE id = $1`,
            [order.tier_id]
          );
          ticketTierName = tierRes.rows[0]?.name || null;
        } catch (tierErr) {
          logger.warn(`Could not fetch tier name for tier ${order.tier_id}:`, tierErr);
        }
      }

      const buyerName = registerInfo.full_name || ctx.from?.first_name || "An attendee";

      // 1) Dispatch organizer notification via Mini-App HMAC client
      try {
        await notifyOrganizerTicketSale({
          orderUuid: orderId,
          eventUuid,
          buyerUserId,
          buyerName,
          amount: starsPaid,
          currency: "Stars",
          ticketTierName,
          tierId: order.tier_id || null,
          feeBps: order.fee_bps ?? 500,
        });
      } catch (notifErr) {
        logger.error(`Error notifying organizer for Stars order ${orderId}:`, notifErr);
      }

      // 2) Send admin channel alert to tickets_topic
      try {
        const estStarsFee = Math.round(starsPaid * 0.05);
        const adminTopicMsg = `
🎟️ <b>Stars Ticket Payment Received</b>

📌 <b>Event:</b> ${event?.title || eventUuid}
🆔 <b>Event UUID:</b> <code>${eventUuid}</code>
🧾 <b>Order UUID:</b> <code>${orderId}</code>
👤 <b>Buyer:</b> <code>${buyerUserId}</code> (${buyerName})
⭐ <b>Stars Paid:</b> ${starsPaid} Stars
💎 <b>Platform Fee (5%):</b> ~${estStarsFee} Stars
`.trim();

        await sendTopicMessage("tickets_topic", adminTopicMsg);
      } catch (logErr) {
        logger.error(`Error sending admin topic message for Stars order ${orderId}:`, logErr);
      }
    }

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
