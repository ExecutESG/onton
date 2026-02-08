import { db } from "@/db/db";
import { eventRegistrants, orders } from "@/db/schema";
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

const addOrderSchema = z.object({
  event_uuid: z.string().uuid(),
  full_name: z.string(),
  telegram: z.string(),
  company: z.string().optional(),
  position: z.string().optional(),
  affiliate_id: z.string().nullable(),
  owner_address: z.string().refine((data) => Address.isAddress(Address.parse(data))),
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
      await db
        .update(orders)
        .set({ state: "new", updatedAt: new Date(), total_price: discountedPrice })
        .where(eq(orders.uuid, userOrder.uuid))
        .execute();
      return Response.json({
        order_id: userOrder.uuid,
        message: "order is placed",
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

          state: "confirming",
          order_type: ticketOrderType,

          utm_source: body.data.affiliate_id,
          updatedBy: "system",
          coupon_id: couponId,
        })
        .returning()
        .execute()
    ).pop();

    new_order_price = new_order?.total_price || -1;

    // insert event registrants
    const register_info = removeKey(body.data, "event_uuid");
    await trx
      .insert(eventRegistrants)
      .values({
        event_uuid: body.data.event_uuid,
        status: "pending",
        register_info: register_info,
        user_id: userId,
      })
      .onConflictDoUpdate({
        target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
        set: {
          status: "pending",
          register_info: register_info,
        },
      })
      .execute();

    new_order_uuid = new_order?.uuid;
  });

  if (new_order && new_order_uuid) {
    return Response.json({
      order_id: new_order_uuid,
      message: "order created successfully",
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
