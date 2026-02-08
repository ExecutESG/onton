import { useQuery } from "@tanstack/react-query";

import { getOrder } from "~/services/orders.services";

export function useGetOrder(order_id: string, noRefetch = false) {
  const enabled = Boolean(order_id);
  return useQuery({
    queryKey: ["get_order", order_id ?? ""] as const,
    queryFn: () => getOrder({ order_id }),
    enabled,
    refetchInterval: noRefetch ? undefined : 1000,
  });
}
