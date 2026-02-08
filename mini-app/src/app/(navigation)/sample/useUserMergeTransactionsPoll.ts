"use client";
import { trpc } from "@/app/_trpc/client";

/**
 * A hook that polls `getUserMergeTransactions` with the provided walletAddress.
 */
export function useUserMergeTransactionsPoll(walletAddress: string) {
  const { data, isLoading } = trpc.campaign.getUserMergeTransactions.useQuery(
    { walletAddress }, // pass param from front-end
    {
      refetchInterval: 10000, // poll every 10s
      enabled: !!walletAddress, // only run if walletAddress is truthy
      staleTime: Infinity,
    }
  );

  return {
    merges: data ?? [],
    isLoading,
  };
}
