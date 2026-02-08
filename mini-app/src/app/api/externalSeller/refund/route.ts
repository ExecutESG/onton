import { logger } from "@/server/utils/logger";
import "@/lib/gracefullyShutdown";
import { getAuthenticatedUserApi } from "@/server/auth";
import { isStructuredErrorShape } from "@/lib/openAPIErrorHandler";
import externalSellerApi from "@/lib/externalSeller.api";
import ordersDB from "@/db/modules/orders.db"; // if you have a default export, adjust this import

export async function POST(request: Request) {
  // Handle OPTIONS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 1) Authenticate the caller
  const [eventOwner, authError] = await getAuthenticatedUserApi(request);
  if (authError) {
    return authError;
  }

  try {
    // 2) Parse & validate body
    const { telegramUserId, eventUuid } = await externalSellerApi.parseRequestRefundBody(request);

    await externalSellerApi.externalSellerApiAccessLimit(eventUuid);

    // 3) Ensure event ownership
    await externalSellerApi.fetchAndValidateEvent(eventUuid, eventOwner);

    // 4) Fetch & sort user orders
    const userOrders = await ordersDB.findOrderByEventUser(eventUuid, telegramUserId);

    // 5) Refund logic
    const result = await externalSellerApi.processRefundLogic(userOrders, eventUuid, telegramUserId);

    // 6) Return final response
    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.message,
        status: result.status,
      }),
      { status: result.httpStatus }
    );
  } catch (err) {
    if (isStructuredErrorShape(err)) {
      return new Response(JSON.stringify(err.errorBody), { status: err.status });
    }
    logger.error("Refund Endpoint Error", err);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        status: "bad_request",
      }),
      { status: 400 }
    );
  }
}

export const dynamic = "force-dynamic";
