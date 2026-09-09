import { db } from "@/db/db";
import { eventRegistrants, orders, tickets } from "@/db/schema";
import "@/lib/gracefullyShutdown";
import { removeKey } from "@/lib/utils";
import { getAuthenticatedUser } from "@/server/auth";
import eventDB from "@/db/modules/events.db";
import ordersDB from "@/db/modules/orders.db";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { Address } from "@ton/core";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/server/utils/logger";
import { applyCouponDiscount } from "@/lib/applyCouponDiscount";
import { issueAndSendEventInviteLink } from "@/lib/eventInviteService";

const addOrderSchema = z.object({
  event_uuid: z.string().uuid(),
  full_name: z.string(),
  telegram: z.string(),
  company: z.string().optional(),
  position: z.string().optional(),
  affiliate_id: z.string().nullable().optional(),
  owner_address: z
    .string()
    .optional()
    .nullable()
    .refine(
      (data) => {
        if (!data || data.trim() === "") return true;
        try {
          return Address.isAddress(Address.parse(data));
        } catch {
          return false;
        }
      },
      { message: "Invalid TON address" }
    ),
  payment_method: z.enum(["TON", "USDT", "STAR"]).optional(),
  coupon_code: z.string().optional().nullable(),
});

//create order if order for that event and user does not exist
//reactivate order with current price

export async function POST(request: Request) {
  const [userId, error] = getAuthenticatedUser();
  if (error) {
    return error;
  }

  const rawBody = await request.json();

  const body = addOrderSchema.safeParse(rawBody);

  if (!body.success) {
    return Response.json(body.error.flatten(), {
      status: 400,
    });
  }

  const eventData = await eventDB.selectEventByUuid(body.data.event_uuid);
  if (!eventData) {
    return Response.json({ message: "event not found" }, { status: 400 });
  }

  const eventPaymentInfo = await db.query.eventPayment.findFirst({
    where(fields, { eq }) {
      return eq(fields.event_uuid, body.data.event_uuid);
    },
  });

  if (!eventPaymentInfo) {
    return Response.json(
      {
        message: "Event payment info does not exist",
      },
      {
        status: 404,
      }
    );
  }

  const paymentToken = await eventTokensDB.getTokenById(eventPaymentInfo.token_id);
  if (!paymentToken) {
    return Response.json({ message: "Payment token misconfigured" }, { status: 500 });
  }

  /* -------------------------------------------------------------------------- */
  /*                   OrderType Based On Event Ticket Setting                  */
  /* -------------------------------------------------------------------------- */
  const eventTicketingType = eventPaymentInfo.ticket_type;

  const ticketOrderTypeMap = {
    NFT: "nft_mint",
    TSCSBT: "ts_csbt_ticket",
  } as const;

  // Ensure TypeScript recognizes the valid key
  const ticketOrderType = ticketOrderTypeMap[eventTicketingType];

  const { isSoldOut } = await ordersDB.checkIfSoldOut(body.data.event_uuid, ticketOrderType, eventData.capacity || 0);

  if (isSoldOut) {
    return Response.json(
      {
        message: "Event tickets are sold out",
      },
      {
        status: 410,
      }
    );
  }
  /* -------------------------------------------------------------------------- */
  /*                            Coupon Code Handling                            */
  /* -------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------- */
  /*                                      ⬆                                     */
  /* -------------------------------------------------------------------------- */

  const userOrder = await db.query.orders.findFirst({
    where: and(
      eq(orders.user_id, userId),
      eq(orders.order_type, ticketOrderType),
      eq(orders.event_uuid, eventData.event_uuid),
      eq(orders.token_id, eventPaymentInfo.token_id)
    ),
  });
  /* -------------------------------------------------------------------------- */
  /*                            Apply Coupon Discount                            */
  /* -------------------------------------------------------------------------- */
  const { discountedPrice, couponId, errorResponse } = await applyCouponDiscount(
    body.data.coupon_code,
    body.data.event_uuid,
    eventPaymentInfo
  );
  if (errorResponse) {
    return errorResponse;
  }
  /* -------------------------------------------------------------------------- */
  /*                            Already Have an Order                           */
  /* -------------------------------------------------------------------------- */
  if (userOrder) {
    if (userOrder.state === "completed") {
      const reg = await db.query.eventRegistrants.findFirst({
        where: and(eq(eventRegistrants.event_uuid, eventData.event_uuid), eq(eventRegistrants.user_id, userId)),
      });
      return Response.json({
        order_id: userOrder.uuid,
        message: "You already have a valid ticket for this event",
        state: "completed",
        is_free: userOrder.total_price === 0,
        invite_link: reg?.telegram_invite_link || null,
        token: {
          token_id: userOrder.token_id,
          symbol: paymentToken.symbol,
          decimals: paymentToken.decimals,
          master_address: paymentToken.master_address,
          is_native: paymentToken.is_native,
          logo_url: paymentToken.logo_url,
        },
        utm_tag: body.data.affiliate_id,
        total_price: userOrder.total_price,
        default_price: eventPaymentInfo.price,
      });
    }

    if (userOrder.state === "failed" || userOrder.state === "cancelled") {
      if (errorResponse) {
        return errorResponse;
      }
      // Reactivate Order
      await db
        .update(orders)
        .set({ state: "new", updatedAt: new Date(), total_price: eventPaymentInfo.price })
        .where(eq(orders.uuid, userOrder.uuid))
        .execute();
      return Response.json({
        order_id: userOrder.uuid,
        message: "order reactivated successfully",
        token: {
          token_id: userOrder.token_id,
          symbol: paymentToken.symbol,
          decimals: paymentToken.decimals,
          master_address: paymentToken.master_address,
          is_native: paymentToken.is_native,
          logo_url: paymentToken.logo_url,
        },
        utm_tag: body.data.affiliate_id,
        total_price: userOrder.total_price,
        default_price: eventPaymentInfo.price,
      });
    }

    if (userOrder.state === "new" || userOrder.state === "confirming") {
      const isFree = discountedPrice === 0;
      const targetState = isFree ? "completed" : "confirming";

      await db.transaction(async (trx) => {
        await trx
          .update(orders)
          .set({
            state: targetState,
            updatedAt: new Date(),
            total_price: discountedPrice,
            owner_address: body.data.owner_address || userOrder.owner_address,
          })
          .where(eq(orders.uuid, userOrder.uuid))
          .execute();

        const register_info = removeKey(body.data, "event_uuid");
        await trx
          .insert(eventRegistrants)
          .values({
            event_uuid: body.data.event_uuid,
            status: isFree ? "approved" : "pending",
            register_info: register_info,
            user_id: userId,
          })
          .onConflictDoUpdate({
            target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
            set: {
              status: isFree ? "approved" : "pending",
              register_info: register_info,
            },
          })
          .execute();

        if (isFree) {
          await trx
            .insert(tickets)
            .values({
              name: body.data.full_name,
              telegram: body.data.telegram,
              company: body.data.company,
              position: body.data.position,
              order_uuid: userOrder.uuid,
              status: "UNUSED",
              event_uuid: body.data.event_uuid,
              ticket_id: eventPaymentInfo.id,
              user_id: userId,
            })
            .execute();
        }
      });

      let inviteLink: string | null = null;
      if (isFree) {
        const reg = await db.query.eventRegistrants.findFirst({
          where: and(eq(eventRegistrants.event_uuid, eventData.event_uuid), eq(eventRegistrants.user_id, userId)),
        });
        if (reg?.id) {
          inviteLink = await issueAndSendEventInviteLink(body.data.event_uuid, userId, reg.id);
        }
      }

      return Response.json({
        order_id: userOrder.uuid,
        message: isFree ? "Ticket claimed successfully!" : "order is placed",
        state: targetState,
        is_free: isFree,
        invite_link: inviteLink,
        token: {
          token_id: userOrder.token_id,
          symbol: paymentToken.symbol,
          decimals: paymentToken.decimals,
          master_address: paymentToken.master_address,
          is_native: paymentToken.is_native,
          logo_url: paymentToken.logo_url,
        },
        total_price: discountedPrice,
        default_price: eventPaymentInfo.price,
      });
    }
  }

  let new_order = null;
  let new_order_uuid = null;
  let new_order_price = -1;
  const isFree = discountedPrice === 0;
  const initialOrderState = isFree ? "completed" : "confirming";
  const initialRegistrantStatus = isFree ? "approved" : "pending";
  let insertedRegistrantId: number | null = null;

  /* -------------------------------------------------------------------------- */
  /*                              Create New Order                              */
  /* -------------------------------------------------------------------------- */

  await db.transaction(async (trx) => {
    logger.info("Coupon Code: ", body.data.coupon_code);

    new_order = (
      await trx
        .insert(orders)
        .values({
          event_uuid: body.data.event_uuid,
          user_id: userId,

          default_price: eventPaymentInfo.price,
          total_price: discountedPrice,
          token_id: eventPaymentInfo.token_id,

          state: initialOrderState,
          order_type: ticketOrderType,
          owner_address: body.data.owner_address || null,

          utm_source: body.data.affiliate_id,
          updatedBy: "system",
          coupon_id: couponId,
        })
        .returning()
        .execute()
    ).pop();

    new_order_price = new_order?.total_price || -1;
    new_order_uuid = new_order?.uuid;

    // insert event registrants
    const register_info = removeKey(body.data, "event_uuid");
    const [regRow] = await trx
      .insert(eventRegistrants)
      .values({
        event_uuid: body.data.event_uuid,
        status: initialRegistrantStatus,
        register_info: register_info,
        user_id: userId,
      })
      .onConflictDoUpdate({
        target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
        set: {
          status: initialRegistrantStatus,
          register_info: register_info,
        },
      })
      .returning({ id: eventRegistrants.id })
      .execute();

    insertedRegistrantId = regRow?.id || null;

    if (isFree && new_order_uuid) {
      await trx
        .insert(tickets)
        .values({
          name: body.data.full_name,
          telegram: body.data.telegram,
          company: body.data.company,
          position: body.data.position,
          order_uuid: new_order_uuid,
          status: "UNUSED",
          event_uuid: body.data.event_uuid,
          ticket_id: eventPaymentInfo.id,
          user_id: userId,
        })
        .execute();
    }
  });

  let inviteLink: string | null = null;
  if (isFree && insertedRegistrantId) {
    inviteLink = await issueAndSendEventInviteLink(body.data.event_uuid, userId, insertedRegistrantId);
  }

  if (new_order && new_order_uuid) {
    return Response.json({
      order_id: new_order_uuid,
      message: isFree ? "Ticket claimed successfully!" : "order created successfully",
      state: initialOrderState,
      is_free: isFree,
      invite_link: inviteLink,
      utm_tag: body.data.affiliate_id,
      token: {
        token_id: eventPaymentInfo.token_id,
        symbol: paymentToken.symbol,
        decimals: paymentToken.decimals,
        master_address: paymentToken.master_address,
        is_native: paymentToken.is_native,
        logo_url: paymentToken.logo_url,
      },
      total_price: new_order_price,
      default_price: eventPaymentInfo.price,
    });
  } else {
    return Response.json({
      message: "failed to insert the order",
    });
  }
}

export const dynamic = "force-dynamic";
