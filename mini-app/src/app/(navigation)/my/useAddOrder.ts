import { useMutation } from "@tanstack/react-query";

type PaymentToken = {
  token_id: number;
  symbol: string;
  decimals: number;
  master_address?: string | null;
  is_native?: boolean | null;
  logo_url?: string | null;
};

async function addOrder(body: {
  full_name: string;
  telegram: string;
  company: string;
  position: string;
  owner_address: string;
  event_uuid: string;
  utm: string | null;
}) {
  const eventResponse = await fetch(`${process.env.NEXT_PUBLIC_TRPC_BASE_URL}/order`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!eventResponse.ok) {
    throw new Error("Add order failed");
  }

  const event: {
    order_id: string;
    message: string;
    token: PaymentToken;
  } = await eventResponse.json();

  return event;
}

export default function useAddOrder() {
  return useMutation({
    mutationFn: addOrder,
    retry: 2,
  });
}
