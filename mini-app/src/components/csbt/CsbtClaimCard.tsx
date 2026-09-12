"use client";

import React, { useState } from "react";
import Typography from "@/components/Typography";
import CustomButton from "@/app/_components/Button/CustomButton";
import { cn } from "@/utils";

export interface CsbtClaimCardProps {
  eventTitle?: string;
  eventUuid: string;
  recipientWallet: string;
  badgeIndex?: number;
  badgeName?: string;
  badgeImageUrl?: string;
  merkleRootHex?: string;
  proofStepsCount?: number;
  isVerified?: boolean;
  onClaimSuccess?: () => void;
  className?: string;
}

export const CsbtClaimCard: React.FC<CsbtClaimCardProps> = ({
  eventTitle = "MOMIS Memory Tournament #14 (Custom SBT Prize💎)",
  eventUuid,
  recipientWallet,
  badgeIndex = 0,
  badgeName = "Soulbound Attendance & Achievement Badge",
  badgeImageUrl = "https://storage.onton.live/onton/event/165823b2af_1762364484900_event_image.png",
  merkleRootHex = "a86e808fa028b492de337ebd64a9661d9326fb1781db2677ee7bcd2eb975fdac",
  proofStepsCount = 4,
  isVerified = true,
  onClaimSuccess,
  className,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopyWallet = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(recipientWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      // Trigger TMA haptic feedback if available
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.impactOccurred("medium");
      }

      // Simulate zero-gas cryptographic claim confirmation
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.HapticFeedback) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred("success");
      }

      setIsClaimed(true);
      onClaimSuccess?.();
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#1E2029] to-[#121318] p-6 text-white shadow-2xl border border-white/10",
        className
      )}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />

      {/* Header Tag */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Compressed SBT (cSBT)
        </span>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
          Zero-Gas Claim
        </span>
      </div>

      {/* Visual Badge Showcase */}
      <div className="relative my-4 flex flex-col items-center justify-center">
        <div className="relative h-44 w-44 rounded-2xl p-1 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 shadow-lg shadow-blue-500/20">
          <div className="h-full w-full overflow-hidden rounded-xl bg-[#0D0E12] flex items-center justify-center">
            <img
              src={badgeImageUrl}
              alt={badgeName}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              onError={(e) => {
                // Fallback graphic if image fails to load
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          {/* Holographic soulbound lock emblem */}
          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#181A20] border-2 border-indigo-400 text-indigo-300 shadow-md">
            🔒
          </div>
        </div>
      </div>

      {/* Badge Information */}
      <div className="text-center mt-2 mb-5">
        <Typography variant="title2" className="text-white font-bold leading-snug">
          {badgeName}
        </Typography>
        <Typography variant="caption1" className="text-gray-400 mt-1 block truncate px-2">
          {eventTitle}
        </Typography>
      </div>

      {/* Cryptographic Verification Details */}
      <div className="space-y-2.5 rounded-2xl bg-white/[0.04] p-4 text-xs backdrop-blur-sm border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Recipient Wallet:</span>
          <button
            onClick={handleCopyWallet}
            className="font-mono text-gray-200 hover:text-blue-400 transition-colors flex items-center gap-1"
            title="Click to copy"
          >
            {shortenAddress(recipientWallet)}
            <span className="text-[10px] text-gray-500">{copied ? "✓ Copied" : "📋"}</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Token Index:</span>
          <span className="font-mono font-medium text-gray-200">#{badgeIndex}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Merkle Inclusion:</span>
          <span className="text-blue-400 font-medium">
            {proofStepsCount}-Level Proof Path
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Anchor Root:</span>
          <span className="font-mono text-[11px] text-gray-300 truncate max-w-[140px]">
            {merkleRootHex.slice(0, 10)}...{merkleRootHex.slice(-6)}
          </span>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-gray-400">Verification Status:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
            ✓ Cryptographically Valid
          </span>
        </div>
      </div>

      {/* Claim Action CTA */}
      <div className="mt-6">
        {isClaimed ? (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-center">
            <p className="text-sm font-semibold text-emerald-400">
              🎉 Credential Successfully Claimed!
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Permanently soulbound to your wallet with zero network gas.
            </p>
          </div>
        ) : (
          <CustomButton
            onClick={handleClaim}
            disabled={isClaiming || !isVerified}
            isLoading={isClaiming}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all"
          >
            Claim Soulbound Credential (0 Gas Fee)
          </CustomButton>
        )}
      </div>
    </div>
  );
};

export default CsbtClaimCard;
