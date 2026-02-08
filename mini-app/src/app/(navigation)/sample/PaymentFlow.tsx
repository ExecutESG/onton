"use client";

import { trpc } from "@/app/_trpc/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useTransferPayment from "./useTransferPayment";

interface PaymentFlowProps {
  orderId: number;
  walletAddress?: string;
  finalPrice: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  orderUuid: string;
}

/**
 * Statuses that mean the order is done (success or canceled/failed).
 * Adjust these as needed for your system.
 */
const FINAL_STATUSES = ["completed", "cancel", "failed"];

/**
 * PaymentFlow:
 * 1) Fetches and polls an order from `getOrder`.
 * 2) On "Pay," we:
 *    - Insert a "pending" transaction (addTransaction) in DB.
 *    - Update order => "confirming".
 *    - Send the Ton transaction.
 *    - If user cancels, set order => "cancelled".
 * 3) Continues polling until we see the order status as completed/cancel/failed.
 */
export default function PaymentFlow({
  orderId,
  orderUuid,
  walletAddress,
  finalPrice,
  onSuccess,
  onCancel,
}: PaymentFlowProps) {
  const [isPaying, setIsPaying] = useState(false);

  // TRPC queries & mutations
  const { data: order, refetch } = trpc.campaign.getOrder.useQuery({ orderId }, { enabled: true });
  const updateStatusMutation = trpc.campaign.updateOrderStatusConfirmCancel.useMutation({
    onSuccess: () => refetch(),
    onError: (error) => toast.error(error.message),
  });
  const addTransactionMutation = trpc.campaign.addTransaction.useMutation();

  // Transfer logic hook
  const transfer = useTransferPayment();

  // 1) Poll if order is not final
  useEffect(() => {
    if (!order) return;
    if (FINAL_STATUSES.includes(order.status)) return;

    const intervalId = setInterval(() => refetch(), 2000);
    return () => clearInterval(intervalId);
  }, [order, refetch]);

  // 2) If order is final, invoke onSuccess/onCancel
  useEffect(() => {
    if (!order) return;
    if (!FINAL_STATUSES.includes(order.status)) return;

    if (order.status === "completed") {
      toast.success(`Order #${order.id} status: ${order.status} (Payment Success)`);
      onSuccess?.();
    } else {
      toast.error(`Order #${order.id} status: ${order.status} (Canceled/Failed)`);
      onCancel?.();
    }
  }, [order, onSuccess, onCancel]);

  // 3) Payment function
  async function handlePay() {
    if (!walletAddress) {
      toast.error("No destination address!");
      return;
    }
    try {
      setIsPaying(true);

      // (A) Insert a "pending" transaction record in the DB
      const pendingTx = await addTransactionMutation.mutateAsync({
        orderId,
        walletAddress,
        finalPrice,
      });
      console.log("Created transaction row:", pendingTx);

      // (B) Then set order => "confirming"
      await updateStatusMutation.mutateAsync({ orderId, status: "confirming" });
      console.log(`Order #${orderId} => "confirming" (OnionCampaign=${orderUuid})`);

      // (C) Next, send the Ton transaction
      await transfer(walletAddress, finalPrice, "TON", { comment: `OnionCampaign=${orderUuid}` });
      toast.success("Transaction broadcasted! Polling order status...");

      // (D) The cron job or on-chain logic will set final status => "completed" or "failed"
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Transaction canceled or failed!");

      // (E) If error => mark order => "cancelled"
      await updateStatusMutation.mutateAsync({ orderId, status: "cancelled" });
      onCancel?.();
    } finally {
      setIsPaying(false);
      refetch();
    }
  }

  // 4) Rendering
  if (!order) {
    return <p className="text-gray-600">Fetching order info…</p>;
  }

  const isFinal = FINAL_STATUSES.includes(order.status);

  return (
    <div>
      {isFinal ? (
        <div>
          {order.status === "completed" ? (
            <p className="text-green-600">Payment was successful! Current status: {order.status}</p>
          ) : (
            <p className="text-red-600">Payment canceled or failed. Current status: {order.status}</p>
          )}
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePay();
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={isPaying}
        >
          {isPaying ? "Processing..." : `Pay ${finalPrice} TON`}
        </button>
      )}

      <p className="mt-2 text-gray-600">
        Order Status: <strong>{order.status}</strong>
      </p>
    </div>
  );
}
