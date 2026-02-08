import { logger } from "@/server/utils/logger";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { couponDefinitionsDB } from "@/db/modules/couponDefinitions.db";

export async function applyCouponDiscount(
  couponCode: string | undefined | null,
  eventUuid: string,
  eventPaymentInfo: { price: number }
): Promise<{
  discountedPrice: number;
  couponId: number | null;
  errorResponse?: Response;
}> {
  // Start with the default price and no coupon
  let discountedPrice = eventPaymentInfo.price;
  let couponId: number | null = null;

  if (logger) {
    logger.info("Coupon Code Received:", couponCode);
  }

  // If there's no coupon code or it's empty, just return the defaults
  if (!couponCode || couponCode.trim() === "") {
    return { discountedPrice, couponId: null };
  }

  // --- 1) Lookup the coupon ---
  const coupon = await couponItemsDB.getByCodeAndEventUuid(couponCode, eventUuid);
  if (!coupon) {
    return {
      discountedPrice,
      couponId,
      errorResponse: Response.json({ message: "Coupon not found" }, { status: 404 }),
    };
  }

  // --- 2) Fetch & validate coupon definition ---
  const couponDefinition = await couponDefinitionsDB.getCouponDefinitionById(coupon.coupon_definition_id);
  if (!couponDefinition) {
    return {
      discountedPrice,
      couponId,
      errorResponse: Response.json({ message: "Coupon definition not found" }, { status: 404 }),
    };
  }

  // --- 3) Validate coupon & definition status ---
  if (coupon.coupon_status === "used") {
    return {
      discountedPrice,
      couponId,
      errorResponse: Response.json({ message: "Coupon is inactive" }, { status: 400 }),
    };
  }

  if (couponDefinition.cpd_status !== "active") {
    return {
      discountedPrice,
      couponId,
      errorResponse: Response.json({ message: "Coupon definition is not active" }, { status: 400 }),
    };
  }

  // --- 4) Apply discount ---
  couponId = coupon.id;
  if (couponDefinition.cpd_type === "percent") {
    // Percent discount

    discountedPrice = eventPaymentInfo.price - eventPaymentInfo.price * (couponDefinition.value / 100) + Number.EPSILON;
    // fix floating point to 3 decimal places
    discountedPrice = Math.round(discountedPrice * 1000) / 1000;
    logger.info(`Applying ${couponDefinition.value}% discount to price ${eventPaymentInfo.price} => ${discountedPrice}`);
  } else if (couponDefinition.cpd_type === "fixed") {
    // Fixed discount
    discountedPrice = eventPaymentInfo.price - couponDefinition.value;
  }
  // Prevent negative price
  discountedPrice = Math.max(discountedPrice, 0);

  return { discountedPrice, couponId };
}
