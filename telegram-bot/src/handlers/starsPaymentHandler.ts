import { MyContext } from "../types/MyContext";
import { pool } from "../db/pool";
import { logger } from "../utils/logger";

/**
 * Handle Telegram Stars pre-checkout query (must be answered within 10 seconds)
 */
export async function handleStarsPreCheckout(ctx: MyContext) {
  try {
    await ctx.answerPreCheckoutQuery(true);
    logger.log(`Approved pre_checkout_query from user ${ctx.from?.id}`);
  } catch (error) {
    logger.error("Error in handleStarsPreCheckout:", error);
    try {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: "Payment processing failed. Please try again.",
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

  const orderId = payment.invoice_payload;
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
           "updatedAt" = NOW(),
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

    // 2) Update event_registrants to approved
    const regRes = await client.query(
      `UPDATE event_registrants
       SET status = 'approved',
           "updatedAt" = NOW(),
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
        `INSERT INTO tickets (name, telegram, company, position, order_uuid, status, event_uuid, event_ticket_id, user_id, updated_by)
         VALUES ($1, $2, $3, $4, $5, 'UNUSED', $6, $7, $8, 'stars_payment')
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
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "OntonBot";
    const appUrl = `https://t.me/${botUsername}/ticket?startapp=${eventUuid}`;

    const replyText =
      `🎉 <b>Payment Received! (${starsPaid} Stars)</b>\n\n` +
      `Your ticket for <b>${event?.title || "the event"}</b> has been issued!\n` +
      (inviteLink
        ? `\n🔗 <b>Private Chat Invite:</b>\n${inviteLink}\n<i>(One-time use, keep private)</i>\n`
        : "") +
      `\nTap the button below to view your ticket and QR check-in code.`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "🎟 View My Ticket",
            url: appUrl,
          },
        ],
        ...(inviteLink
          ? [
              [
                {
                  text: "💬 Join Event Chat",
                  url: inviteLink,
                },
              ],
            ]
          : []),
      ],
    };

    await ctx.reply(replyText, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error handling Stars successful payment:", error);
  } finally {
    client.release();
  }
}
