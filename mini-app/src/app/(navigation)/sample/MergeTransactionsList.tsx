"use client";
import React from "react";
import { useUserMergeTransactionsPoll } from "./useUserMergeTransactionsPoll";

interface MergeTransactionsListProps {
  walletAddress: string;
}

/**
 * MergeTransactionsList:
 * Displays a list of merge transactions for the given wallet address,
 * auto-refreshing every 10 seconds via useUserMergeTransactionsPoll.
 */
export default function MergeTransactionsList({ walletAddress }: MergeTransactionsListProps) {
  const { merges, isLoading } = useUserMergeTransactionsPoll(walletAddress);

  if (!walletAddress) {
    return <p className="text-red-600">No valid wallet address provided.</p>;
  }

  if (isLoading) {
    return <p>Loading merges...</p>;
  }

  if (merges.length === 0) {
    return <p>No merges found.</p>;
  }

  return (
    <ul>
      {merges.map((m) => (
        <li key={m.id}>
          Merge #{m.id}, status={m.status}, hash={m.transactionHash}
        </li>
      ))}
    </ul>
  );
}
