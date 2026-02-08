import { z } from "zod";
import { logger } from "@/server/utils/logger";
import { getAuthenticatedUser } from "@/server/auth";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { couponDefinitionsDB } from "@/db/modules/couponDefinitions.db";
import eventDB from "@/db/modules/events.db";
import { checkRateLimit } from "@/lib/checkRateLimit";
import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { applyCouponDiscount } from "@/lib/applyCouponDiscount";
/* -------------------------------------------------------------------------- */
/*                             Schema Definition                              */
/* -------------------------------------------------------------------------- */
const couponCheckSchema = z.object({
  coupon_code: z.string().nonempty("Coupon code is required."),
  event_id: z.number().int().positive("Event ID is required."),
});

/* -------------------------------------------------------------------------- */
/*                                Route Handler                               */

/* -------------------------------------------------------------------------- */
export async function GET(request: Request, { params }: { params: { id: number; couponCode: string } }) {
  try {
    // If your auth returns [userId, error] or similar:
    const [userId, authError] = getAuthenticatedUser();
    if (authError && !userId) {
      return authError;
    }

    const { allowed } = await checkRateLimit(userId?.toString(), "checkCoupon", 3, 60);
    if (!allowed) {
      return NextResponse.json({ message: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
    }
    // Parse incoming JSON
    const parsed = couponCheckSchema.safeParse({
      event_id: Number(params.id),
      coupon_code: params.couponCode,
    });
    if (!parsed.success) {
      // Return validation errors
      return Response.json(parsed.error.flatten(), { status: 400 });
    }

    const { coupon_code, event_id } = parsed.data;
    const eventData = await eventDB.fetchEventById(event_id);
    if (!eventData) {
      return Response.json({ message: "Event not found" }, { status: 404 });
    }
    const event_uuid = eventData.event_uuid;
    // 1) Fetch coupon by its code
    //    Replace this call with your actual DB logic
    const coupon = await couponItemsDB.getByCodeAndEventUuid(coupon_code, event_uuid);

    if (!coupon) {
      return Response.json({ message: "Coupon not found" }, { status: 404 });
    }
    const coupon_definition = await couponDefinitionsDB.getCouponDefinitionById(coupon.coupon_definition_id);
    if (!coupon_definition) {
      return Response.json({ message: "Coupon definition not found" }, { status: 404 });
    }

    if (coupon.coupon_status === "used") {
      return Response.json({ message: "Coupon is inactive" }, { status: 400 });
    }
    if (coupon_definition.cpd_status !== "active") {
      return Response.json({ message: "Coupon definition is not active" }, { status: 400 });
    }

    const eventPaymentInfo = await db.query.eventPayment.findFirst({
      where(fields, { eq }) {
        return eq(fields.event_uuid, event_uuid);
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

    const { discountedPrice, couponId, errorResponse } = await applyCouponDiscount(
      coupon_code,
      event_uuid,
      eventPaymentInfo
    );
    if (errorResponse) {
      return errorResponse;
    }
    const definitionOutput = {
      cpd_type: coupon_definition.cpd_type,
      cpd_status: coupon_definition.cpd_status,
      value: coupon_definition.value,
      start_date: coupon_definition.start_date,
      end_date: coupon_definition.end_date,
      discounted_price: discountedPrice,
      coupon_id: couponId,
    };
    // 3) If all checks pass, return coupon info
    return Response.json(
      {
        message: "Coupon is valid",
        data: { item: coupon, definition: definitionOutput },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("coupon_check_api_error", error);
    return Response.json({ message: "Something Went Wrong" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
