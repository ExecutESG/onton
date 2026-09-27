"use client";

import { useState } from "react";
import useWebApp from "@/hooks/useWebApp";
import { FiAward, FiExternalLink, FiLoader } from "react-icons/fi";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { trpc } from "@/app/_trpc/client";
import { toast } from "sonner";

interface ClaimSbtButtonProps {
  rewardLink?: string | null;
  ticketUuid?: string | null;
  isMinted?: boolean;
}

/**
 * Handles viewing or on-demand claiming of native TEP-85 SBT attendance badges.
 */
export function ClaimSbtButton({ rewardLink, ticketUuid, isMinted = false }: ClaimSbtButtonProps) {
  const webApp = useWebApp();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [claiming, setClaiming] = useState(false);
  const [activeRewardLink, setActiveRewardLink] = useState<string | null>(rewardLink || null);

  const claimMutation = trpc.sbt.claimAttendanceSbt.useMutation({
    onSuccess: (data) => {
      setClaiming(false);
      setActiveRewardLink(data.rewardLink);
      toast.success("SBT Attendance Badge minted successfully!");
    },
    onError: (err) => {
      setClaiming(false);
      toast.error(err.message || "Failed to mint SBT badge");
    },
  });

  const handleOpenLink = (url: string) => {
    try {
      if (webApp?.openLink) {
        webApp.openLink(url);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  const handleClaim = async () => {
    if (!ticketUuid) return;

    const userWallet = wallet?.account?.address;
    if (!userWallet) {
      toast.info("Please connect your TON wallet to receive your SBT badge.");
      tonConnectUI.openModal();
      return;
    }

    setClaiming(true);
    claimMutation.mutate({
      ticketUuid,
      walletAddress: userWallet,
    });
  };

  // If already minted or just claimed
  if (activeRewardLink) {
    return (
      <button
        onClick={() => handleOpenLink(activeRewardLink)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 py-3 text-sm font-semibold text-white shadow transition-all hover:from-amber-600 hover:to-yellow-700 active:scale-[0.98]"
      >
        <FiAward className="h-4 w-4" />
        View SBT Badge (TEP-85)
        <FiExternalLink className="h-3.5 w-3.5 opacity-80" />
      </button>
    );
  }

  // Not minted yet: allow on-demand claim
  return (
    <button
      onClick={handleClaim}
      disabled={claiming}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow transition-all hover:from-purple-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60"
    >
      {claiming ? (
        <>
          <FiLoader className="h-4 w-4 animate-spin" />
          Minting Badge on TON...
        </>
      ) : (
        <>
          <FiAward className="h-4 w-4" />
          {wallet ? "Claim Attendance SBT Badge" : "Connect Wallet & Claim SBT"}
        </>
      )}
    </button>
  );
}
