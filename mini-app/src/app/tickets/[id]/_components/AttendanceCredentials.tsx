"use client";

import { useState } from "react";
import useWebApp from "@/hooks/useWebApp";
import { FiAward, FiExternalLink, FiLoader, FiShield, FiChevronDown, FiChevronUp, FiCopy, FiCheck, FiZap } from "react-icons/fi";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { trpc } from "@/app/_trpc/client";
import { toast } from "sonner";
import { beginCell, toNano } from "@ton/core";
import { SBT_ONCHAIN_UPGRADE_PRICE } from "@/constants";

interface AttendanceCredentialsProps {
  ticketUuid?: string | null;
  rewardLink?: string | null;
  isMinted?: boolean;
  treasuryAddress?: string | null;
}

/**
 * Dual-tier attendance credentials component:
 * 1. Free Zero-Gas cSBT: Merkle-anchored attendance proof in-app.
 * 2. Optional On-Chain TEP-85 Upgrade (0.1 TON): Direct mint to attendee's personal wallet.
 */
export function AttendanceCredentials({
  ticketUuid,
  rewardLink,
  isMinted = false,
  treasuryAddress: initialTreasuryAddress,
}: AttendanceCredentialsProps) {
  const webApp = useWebApp();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [activeRewardLink, setActiveRewardLink] = useState<string | null>(rewardLink || null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<string>("");
  const [showProofDetails, setShowProofDetails] = useState(false);
  const [copiedRoot, setCopiedRoot] = useState(false);

  // Fetch treasury config if not passed via props
  const { data: treasuryConfig } = trpc.sbt.getTreasuryConfig.useQuery(undefined, {
    enabled: !initialTreasuryAddress,
  });
  const effectiveTreasuryAddress = initialTreasuryAddress || treasuryConfig?.treasuryAddress;

  // Fetch free tier cSBT data
  const { data: csbtData, isLoading: csbtLoading } = trpc.sbt.getTicketCsbt.useQuery(
    { ticketUuid: ticketUuid! },
    { enabled: Boolean(ticketUuid) }
  );

  const upgradeMutation = trpc.sbt.materializeOnChainSbt.useMutation({
    onSuccess: (data) => {
      setIsUpgrading(false);
      setUpgradeStep("");
      setActiveRewardLink(data.explorerUrl);
      toast.success("TEP-85 SBT Token minted to your wallet!");
    },
    onError: (err) => {
      setIsUpgrading(false);
      setUpgradeStep("");
      toast.error(err.message || "Failed to finalize on-chain SBT");
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

  const handleCopyRoot = (rootHex: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(rootHex);
      setCopiedRoot(true);
      setTimeout(() => setCopiedRoot(false), 2000);
    }
  };

  const handleUpgradeToOnChain = async () => {
    if (!ticketUuid) return;

    const userWallet = wallet?.account?.address;
    if (!userWallet) {
      toast.info("Please connect your TON wallet to upgrade to an on-chain token.");
      tonConnectUI.openModal();
      return;
    }

    if (!effectiveTreasuryAddress) {
      toast.error("Treasury wallet not configured. Please try again later.");
      return;
    }

    try {
      setIsUpgrading(true);
      setUpgradeStep("Awaiting wallet approval...");

      const body = beginCell()
        .storeUint(0, 32)
        .storeStringTail(`sbt_upgrade:${ticketUuid}`)
        .endCell()
        .toBoc();

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: effectiveTreasuryAddress,
            amount: toNano(String(SBT_ONCHAIN_UPGRADE_PRICE)).toString(),
            payload: body.toString("base64"),
          },
        ],
      });

      setUpgradeStep("Verifying payment & deploying token...");
      upgradeMutation.mutate({
        ticketUuid,
        walletAddress: userWallet,
      });
    } catch (err: unknown) {
      setIsUpgrading(false);
      setUpgradeStep("");
      const message = err instanceof Error ? err.message : "Transaction cancelled or failed";
      if (!message.includes("Cancelled") && !message.includes("Rejected")) {
        toast.error(message);
      } else {
        toast.info("Transaction cancelled");
      }
    }
  };

  return (
    <div className="space-y-3 pt-2">
      {/* ------------------------------------------------------------- */}
      {/* TIER 1: Free In-App cSBT Credential Card                     */}
      {/* ------------------------------------------------------------- */}
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FiShield className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Proof of Attendance (cSBT)
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            <FiZap className="h-3 w-3" />
            Zero Gas • Active
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {csbtData?.badgeImageUrl ? (
            <img
              src={csbtData.badgeImageUrl}
              alt="Badge Preview"
              className="h-14 w-14 rounded-xl border border-blue-200 object-cover shadow-sm"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-2xl shadow-inner">
              🏅
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-gray-900">
              {csbtData?.badgeName || "Attendance Credential"}
            </h4>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {csbtData?.eventTitle || "Official Soulbound Badge"}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Cryptographically Verified in Merkle Tree
            </div>
          </div>
        </div>

        {/* Expandable Cryptographic Details */}
        <button
          type="button"
          onClick={() => setShowProofDetails(!showProofDetails)}
          className="mt-3 flex w-full items-center justify-between border-t border-blue-100/80 pt-2.5 text-[11px] font-medium text-blue-600 hover:text-blue-700"
        >
          <span>{showProofDetails ? "Hide Proof Details" : "Inspect Merkle Proof"}</span>
          {showProofDetails ? <FiChevronUp className="h-3.5 w-3.5" /> : <FiChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showProofDetails && csbtData && (
          <div className="mt-2 space-y-1.5 rounded-xl bg-blue-50/50 p-2.5 text-[11px] text-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Leaf Index:</span>
              <span className="font-mono font-semibold text-gray-800">#{csbtData.leafIndex}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Proof Steps:</span>
              <span className="font-semibold text-blue-700">{csbtData.proofStepsCount}-Level Branch</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-gray-500">Merkle Root:</span>
              <button
                type="button"
                onClick={() => handleCopyRoot(csbtData.merkleRootHex)}
                className="flex items-center gap-1 font-mono text-[10px] text-gray-700 hover:text-blue-600"
                title="Click to copy full root"
              >
                <span>
                  {csbtData.merkleRootHex.slice(0, 10)}...{csbtData.merkleRootHex.slice(-6)}
                </span>
                {copiedRoot ? <FiCheck className="h-3 w-3 text-emerald-600" /> : <FiCopy className="h-3 w-3 text-gray-400" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TIER 2: Optional On-Chain TEP-85 Upgrade (0.1 TON)           */}
      {/* ------------------------------------------------------------- */}
      {activeRewardLink ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FiAward className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-900">
                TEP-85 Token Minted On-Chain
              </span>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              Personal Wallet
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Your attendance token is live on TON and visible in Tonkeeper and Getgems.
          </p>
          <button
            type="button"
            onClick={() => handleOpenLink(activeRewardLink)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-yellow-700 active:scale-[0.98]"
          >
            <FiAward className="h-3.5 w-3.5" />
            View on TON Explorer (TEP-85)
            <FiExternalLink className="h-3 w-3 opacity-80" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-b from-purple-50/50 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900">
              Export to Personal TON Wallet
            </span>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
              {SBT_ONCHAIN_UPGRADE_PRICE} TON
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            Mint a standalone TEP-85 token directly to your wallet for Getgems, Tonkeeper, and external dApps.
          </p>

          <button
            type="button"
            onClick={handleUpgradeToOnChain}
            disabled={isUpgrading || csbtLoading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-xs font-semibold text-white shadow-md transition-all hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60"
          >
            {isUpgrading ? (
              <>
                <FiLoader className="h-3.5 w-3.5 animate-spin" />
                <span>{upgradeStep || "Processing..."}</span>
              </>
            ) : (
              <>
                <FiAward className="h-3.5 w-3.5" />
                <span>
                  {wallet ? `Mint to Personal Wallet (${SBT_ONCHAIN_UPGRADE_PRICE} TON)` : "Connect Wallet & Upgrade (0.1 TON)"}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default AttendanceCredentials;
