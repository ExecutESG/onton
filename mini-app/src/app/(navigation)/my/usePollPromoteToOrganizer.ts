import { useConfig } from "@/context/ConfigContext";
import { useUserStore } from "@/context/store/user.store";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useTransferTon from "./useTransfer";
import { trpc } from "@/app/_trpc/client";

const emptyObject = {};
const orderProcessingStates = ["new", "processing", "confirming"];
const orderFinishedStates = ["failed", "completed", "cancelled"];
export default function usePollPromoteToOrganizer(onFinish: (_success: boolean) => void) {
  const { user } = useUserStore();
  const role = user?.role;
  const [state, setState] = useState<"ready" | "processing" | "done">(role === "organizer" ? "done" : "ready");
  const trpcUtils = trpc.useUtils();
  const { data } = trpc.orders.getPromoteToOrganizerOrder.useQuery(emptyObject, {
    enabled: state === "processing" && role !== "organizer",
    onSuccess(data) {
      const orderState = data?.state || "chert val";
      if (orderFinishedStates.includes(orderState)) {
        setState("done");
        const isComplete = orderState === "completed";
        if (isComplete) {
          trpcUtils.users.syncUser.invalidate(undefined, { refetchType: "all" });
        }
        onFinish(isComplete);
        return;
      }
      if (state === "ready" && orderProcessingStates.includes(orderState)) {
        setState("processing");
      }

      // for other states, refetch
      setTimeout(() => {
        trpcUtils.orders.getPromoteToOrganizerOrder.invalidate(emptyObject);
      }, 2000);
    },
  });

  const transfer = useTransferTon();
  const userToOrganizerMutation = trpc.orders.addPromoteToOrganizerOrder.useMutation();
  const config = useConfig();
  const onPay = useCallback(async () => {
    if (state !== "ready") return;

    try {
      const response = await userToOrganizerMutation.mutateAsync(emptyObject);
      const tokenSymbol = (response.token?.symbol || "TON") as "TON";
      await transfer(
        (config.ONTON_WALLET_ADDRESS as string) || "UQA02ekDpWFrIL5xh5g7WVY6UrcQRINXli5gDlD7cQrEkfOM",
        Number(response.total_price),
        tokenSymbol,
        {
          comment: `onton_order=${response.uuid}`,
        }
      );
      setState("processing");
    } catch (error) {
      toast.error("Transaction was not successful. Please try again.");
      console.error("Error during transfer:", error);
      setState("ready");
    }
  }, [config.ONTON_WALLET_ADDRESS, state, transfer, userToOrganizerMutation]);

  const orderState = data?.state;
  return {
    state: state === "done" ? (orderState === "completed" ? "completed" : "failed") : state,
    onPay,
  } as {
    state: "completed" | "failed" | "processing" | "ready";
    onPay: () => void;
  };
}
