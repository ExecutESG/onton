import { env } from "~/env.mjs";
import { GetOrderResponse, PaymentToken } from "~/types/order.types";

export async function addOrder(body: {
  full_name: string;
  telegram: string;
  company?: string;
  position?: string;
  owner_address: string;
  event_uuid: string;
  affiliate_id: string | null;
  coupon_code: string | null;
}) {
  const orderResponse = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/order`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!orderResponse.ok) {
    if (orderResponse.status !== 500) {
      const errorData = await orderResponse.json();
      throw new Error(errorData.message);
    } else {
      throw new Error(`${orderResponse.status} - There was an error adding a new order`);
    }
  }

  const order: {
    order_id: string;
    message: string;
    total_price: number;
    token: PaymentToken;
  } = await orderResponse.json();

  return order;
}

/**
 * Client Side Fetching (token cookie will be present)
 */
export async function getOrder({ order_id }: { order_id: string }) {
  if (!order_id) {
    return;
  }

  const eventResponse = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/order/${order_id}`, {
    method: "GET",
  });

  if (!eventResponse.ok) {
    throw new Error("Fetching order failed");
  }

  const event: GetOrderResponse = await eventResponse.json();

  return event;
}
