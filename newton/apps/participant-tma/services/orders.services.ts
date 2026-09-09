import { env } from "~/env.mjs";
import { GetOrderResponse, PaymentToken } from "~/types/order.types";

export async function addOrder(body: {
  full_name: string;
  telegram: string;
  company?: string;
  position?: string;
  owner_address?: string | null;
  payment_method?: "TON" | "USDT" | "STAR";
  event_uuid: string;
  affiliate_id: string | null;
  coupon_code: string | null;
}) {
  const orderResponse = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!orderResponse.ok) {
    if (orderResponse.status !== 500) {
      const errorData = await orderResponse.json();
      throw new Error(errorData.message || "Failed to create order");
    } else {
      throw new Error(`${orderResponse.status} - There was an error adding a new order`);
    }
  }

  const order: {
    order_id: string;
    message: string;
    total_price: number;
    token: PaymentToken;
    state?: string;
    is_free?: boolean;
    invite_link?: string | null;
  } = await orderResponse.json();

  return order;
}

export async function createStarsInvoice(order_id: string) {
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/order/stars-invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.details || errorData.error || "Failed to create Stars invoice");
  }

  return res.json() as Promise<{
    success: boolean;
    invoice_link: string;
    stars_amount: number;
    order_id: string;
  }>;
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
