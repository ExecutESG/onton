import { z } from "zod";
import { logger } from "@/server/utils/logger";
import eventDB from "@/db/modules/events.db";
import { eventRegistrants, orders } from "@/db/schema";
import { db } from "@/db/db";
import ordersDB from "@/db/modules/orders.db";
import { usersDB } from "@/db/modules/users.db";
import { OrderTypeValues } from "@/db/schema/orders";
import rewardService from "@/services/rewardsService";
import rewardDB from "@/db/modules/rewards.db";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { and, eq } from "drizzle-orm";
import { is_local_env } from "@/server/utils/evnutils";
import { ALLOWED_TONFEST_EVENT_UUIDS } from "@/constants";

/* -------------------------------------------------------------------------- */
/*                           Zod Schema Definition                            */
/* -------------------------------------------------------------------------- */
const verifiedAsPaidSchema = z.object({
  telegramUserId: z.number(),
  telegramUsername: z.string().min(1),
  eventUuid: z.string().uuid(),
  paymentTokenSymbol: z.string().min(1),
  paymentAmount: z.number().default(0),
});

const refundSchema = z.object({
  telegramUserId: z.number().positive(),
  eventUuid: z.string().uuid(),
});
/* -------------------------------------------------------------------------- */
/*                          Helper / Utility Functions                        */

/* -------------------------------------------------------------------------- */
const externalSellerApiAccessLimit = async (eventUuid: string) => {
  if (!ALLOWED_TONFEST_EVENT_UUIDS.includes(eventUuid) && !is_local_env()) {
    throw {
      status: 500,
      errorBody: {
        success: false,
        message: "Your API KEY has Not permission to use this endpoint",
        status: "access_blocked",
      },
    };
  }
};

/**
 * Validate & parse the request body using Zod schema
 */
const parseAndValidateRequest = async (request: Request) => {
  const rawBody = await request.json();
  const parseResult = verifiedAsPaidSchema.safeParse(rawBody);

  if (!parseResult.success) {
    throw {
      status: 400,
      errorBody: {
        success: false,
        status: "bad_request",
        message: "Invalid request body",
        errors: parseResult.error.flatten(),
      },
    };
  }
  const data = parseResult.data;
  data.paymentTokenSymbol = data.paymentTokenSymbol.toUpperCase();
  return data; // { telegramUserId, telegramUsername, eventUuid, paymentTokenSymbol, paymentAmount }
};

/**
 * Fetch event data and validate ownership & activity.
 * Throws structured errors if checks fail.
 */
const fetchAndValidateEvent = async (eventUuid: string, eventOwnerId: number) => {
  const eventData = await eventDB.selectEventByUuid(eventUuid);

  if (!eventData) {
    throw {
      status: 404,
      errorBody: {
        success: false,
        message: "Event not found",
        status: "event_not_exist",
      },
    };
  }

  // Check if the authenticated user is the owner
  if (eventData.owner !== eventOwnerId) {
    throw {
      status: 401,
      errorBody: { message: "Unauthorized Access to event" },
    };
  }

  // Check if event is published
  if (!eventData.activity_id) {
    throw {
      status: 410,
      errorBody: {
        success: false,
        message: "Event not published yet",
        status: "event_not_active",
      },
    };
  }

  return eventData;
};

/**
 * Fetch payment info for the event, determine ticket order type,
 * and optionally check if the event is sold out.
 */
const fetchPaymentInfoAndCheckSoldOut = async (eventUuid: string, eventData: any) => {
  const eventPaymentInfo = await db.query.eventPayment.findFirst({
    where(fields, { eq }) {
      return eq(fields.event_uuid, eventUuid);
    },
  });

  if (!eventPaymentInfo) {
    throw {
      status: 404,
      errorBody: {
        success: false,
        message: "Event payment info does not exist",
        status: "event_not_exist",
      },
    };
  }

  // Suppose eventPaymentInfo.ticket_type is either "NFT" or "TSCSBT"
  const ticketOrderTypeMap = {
    NFT: "nft_mint",
    TSCSBT: "ts_csbt_ticket",
  } as const;

  const eventTicketingType = eventPaymentInfo.ticket_type as keyof typeof ticketOrderTypeMap;
  const orderType = ticketOrderTypeMap[eventTicketingType] ?? "nft_mint";

  // Check if sold out
  const { isSoldOut } = await ordersDB.checkIfSoldOut(eventUuid, orderType, eventData.capacity || 0);
  if (isSoldOut) {
    throw {
      status: 410,
      errorBody: {
        success: false,
        message: "Event tickets are sold out",
        status: "sold_out",
      },
    };
  }

  return { eventPaymentInfo, orderType };
};

/**
 * Insert or update user if needed, based on telegramUserId.
 */
const ensureUserExists = async (
  telegramUserId: number,
  telegramUsername: string = "",
  defaultFirstName: string = "PaymentFlow"
) => {
  const existingUser = await usersDB.selectUserById(telegramUserId);
  if (existingUser) return existingUser;

  // Insert user if not found
  const initDataJson = {
    user: {
      id: telegramUserId,
      username: telegramUsername.replace("@", ""),
      first_name: defaultFirstName,
      last_name: "",
      language_code: "en",
      is_premium: false,
      allows_write_to_pm: false,
      photo_url: undefined,
    },
  };

  const addedOrFoundUser = await usersDB.insertUser(initDataJson);
  if (!addedOrFoundUser) {
    logger.error("Failed to insert/find user in verifaiedAsPaid", initDataJson);
    throw {
      status: 400,
      errorBody: {
        success: false,
        message: "Failed to insert user",
        status: "user_insert_failed",
      },
    };
  }

  return addedOrFoundUser;
};

/**
 * If there's an existing-completed order, attempt to fetch or generate TSCSBT link
 */
const handleExistingOrder = async (
  existingOrder: any,
  eventUuid: string,
  telegramUserId: number,
  isOntonUser: boolean,
  orderType: string
) => {
  let existingRewardLink = `https://onton.app/claim/${existingOrder.uuid}`;

  if (orderType === "ts_csbt_ticket") {
    try {
      const linkData = await rewardService.CsbtTicketForApi(eventUuid, telegramUserId);

      if (
        linkData &&
        typeof linkData === "object" &&
        "reward_link" in (linkData as Record<string, unknown>) &&
        typeof (linkData as { reward_link?: unknown }).reward_link === "string"
      ) {
        existingRewardLink = (linkData as { reward_link: string }).reward_link || existingRewardLink;
      }
    } catch (err) {
      logger.error("Failed to create or fetch existing TSCSBT link", err);
    }
  }

  // Return a success Response
  return new Response(
    JSON.stringify({
      success: true,
      isOntonUser,
      sbtClaimLink: existingRewardLink,
    }),
    { status: 200 }
  );
};

/**
 * Create a new order & registrant transactional; return the new order
 */
const createOrderAndRegistrant = async (
  eventUuid: string,
  telegramUserId: number,
  paymentAmount: number,
  paymentTokenId: number,
  orderType: OrderTypeValues,
  telegramUsername: string
) => {
  let newOrder = null;

  await db.transaction(async (trx) => {
    newOrder = (
      await trx
        .insert(orders)
        .values({
          event_uuid: eventUuid,
          user_id: telegramUserId,
          total_price: paymentAmount,
          token_id: paymentTokenId,
          state: "completed",
          order_type: orderType,
          utm_source: null,
          updatedBy: "system",
        })
        .returning()
        .execute()
    ).pop();

    // Mark user as an event registrant (upsert with status = "approved")
    await trx
      .insert(eventRegistrants)
      .values({
        event_uuid: eventUuid,
        status: "approved",
        register_info: {
          telegramUsername,
          telegramUserId: String(telegramUserId),
        },
        user_id: telegramUserId,
      })
      .onConflictDoUpdate({
        target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
        set: {
          status: "approved",
          register_info: {
            telegramUsername,
            telegramUserId: String(telegramUserId),
          },
        },
      })
      .execute();
  });

  return newOrder;
};

/**
 * Determine final SBT claim link to return
 */
const getSbtClaimLink = async (eventUuid: string, telegramUserId: number, orderType: string) => {
  // Start with an event-level reward link if it exists
  let sbtClaimLink = `https://onton.live/`;
  const eventRewardLink = await rewardDB.fetchRewardLinkForEvent(eventUuid, "ton_society_csbt_ticket");
  if (
    eventRewardLink &&
    typeof eventRewardLink.data === "object" &&
    "reward_link" in (eventRewardLink.data as Record<string, unknown>) &&
    typeof (eventRewardLink.data as { reward_link?: unknown }).reward_link === "string"
  ) {
    sbtClaimLink = (eventRewardLink.data as { reward_link: string }).reward_link;
  }

  // If it’s TS CSBT, try generating a user-specific link
  if (orderType === "ts_csbt_ticket") {
    try {
      const linkData = await rewardService.CsbtTicketForApi(eventUuid, telegramUserId);

      if (
        linkData &&
        typeof linkData === "object" &&
        "reward_link" in (linkData as Record<string, unknown>) &&
        typeof (linkData as { reward_link?: unknown }).reward_link === "string"
      ) {
        sbtClaimLink = (linkData as { reward_link: string }).reward_link;
      }
    } catch (err) {
      logger.error("Failed to create TSCSBT link", err);
    }
  }

  return sbtClaimLink;
};
/* -------------------------------------------------------------------------- */
/*                               Refund API                                */
/* -------------------------------------------------------------------------- */
/**
 * Parse & validate the request body.
 * Throws an error response if invalid.
 */
const parseRequestRefundBody = async (request: Request) => {
  const rawBody = await request.json();
  const parseResult = refundSchema.safeParse(rawBody);
  if (!parseResult.success) {
    throw {
      status: 400,
      errorBody: {
        success: false,
        status: "bad_request",
        message: "Invalid request body",
        errors: parseResult.error.flatten(),
      },
    };
  }
  return parseResult.data; // => { telegramUserId, eventUuid }
};
/*
 * Locate and refund the latest completed order, or decide what to do if none is found.
 */
const processRefundLogic = async (
  userOrders: any[], // or typed array if you have a model type
  eventUuid: string,
  telegramUserId: number
) => {
  if (userOrders.length === 0) {
    return {
      success: false,
      message: "No order found for this user & event",
      status: "order_not_found",
      httpStatus: 404,
    };
  }

  // Find the first (latest) completed order
  const latestCompleted = userOrders.find((o) => o.state === "completed");
  if (latestCompleted) {
    // We have a completed order to refund
    await db.transaction(async (trx) => {
      // 1) Cancel the order
      await trx
        .update(orders)
        .set({ state: "cancelled", updatedBy: "system" })
        .where(eq(orders.uuid, latestCompleted.uuid))
        .execute();

      // 2) Update the event registrant to "rejected"
      await trx
        .update(eventRegistrants)
        .set({ status: "rejected" })
        .where(and(eq(eventRegistrants.event_uuid, eventUuid), eq(eventRegistrants.user_id, telegramUserId)))
        .execute();
    });

    return {
      success: true,
      message: "Order refunded successfully",
      status: "order_refunded",
      httpStatus: 200,
    };
  }

  // No completed orders - check if there's a cancelled order
  const cancelledOrder = userOrders.find((o) => o.state === "cancelled");
  if (cancelledOrder) {
    return {
      success: false,
      message: "Order was cancelled before",
      status: "order_already_cancelled",
      httpStatus: 409,
    };
  }

  // Possibly "pending", "failed", etc.
  return {
    success: false,
    message: "No completed order found to refund",
    status: "order_not_refundable",
    httpStatus: 400,
  };
};

const externalSellerApi = {
  externalSellerApiAccessLimit,
  parseAndValidateRequest,
  fetchAndValidateEvent,
  fetchPaymentInfoAndCheckSoldOut,
  ensureUserExists,
  handleExistingOrder,
  createOrderAndRegistrant,
  getSbtClaimLink,
  // Refund API
  parseRequestRefundBody,
  processRefundLogic,
};
export default externalSellerApi;
