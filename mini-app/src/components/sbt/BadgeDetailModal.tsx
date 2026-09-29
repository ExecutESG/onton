"use client";

import React, { useState } from "react";
import Image from "next/image";
import OntonDialog from "@/components/OntonDialog";
import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Send, ShieldCheck } from "lucide-react";

export interface BadgeItemData {
  id?: number;
  itemAddress: string;
  collectionAddress?: string | null;
  collectionName?: string | null;
  itemIndex?: number;
  metadata?: any;
  metadataJson?: any;
  metadataUri?: string | null;
  explorerUrl?: string;
  createdAt?: string | Date | null;
  eventTitle?: string | null;
  eventImage?: string | null;
  eventDateFrom?: string | Date | null;
  eventLocation?: string | null;
  eventParticipationType?: string | null;
}

interface BadgeDetailModalProps {
  badge: BadgeItemData | null;
  open: boolean;
  onClose: () => void;
}

function truncateAddress(addr?: string | null): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

export default function BadgeDetailModal({ badge, open, onClose }: BadgeDetailModalProps) {
  const webApp = useWebApp();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!badge) return null;

  const isMainnet = badge.explorerUrl
    ? !badge.explorerUrl.includes("testnet")
    : process.env.NEXT_PUBLIC_ENV === "production";

  const explorerUrl =
    badge.explorerUrl ||
    `https://${isMainnet ? "tonviewer.com" : "testnet.tonviewer.com"}/${badge.itemAddress}`;

  const metadata = ((badge.metadata || badge.metadataJson) as Record<string, any>) || {};
  const badgeTitle = metadata.name || badge.eventTitle || "Attendance Badge";
  const badgeDescription =
    metadata.description || "Official Soulbound Proof of Attendance for this event. Strictly non-transferable.";
  const badgeImage =
    metadata.image || badge.eventImage || "https://dev-storage.dev.onton.live/ontonimage/approved.lottie";

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleOpenExplorer = () => {
    try {
      if (webApp?.openLink) {
        webApp.openLink(explorerUrl);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(explorerUrl, "_blank");
    }
  };

  const handleShare = () => {
    const text = encodeURIComponent(
      `🎖️ I earned my Soulbound Proof of Attendance badge for "${badge.eventTitle || badgeTitle}" on ONTON!\n\nContract: ${badge.itemAddress}`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(explorerUrl)}&text=${text}`;
    try {
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(shareUrl);
        return;
      }
      if (webApp?.openLink) {
        webApp.openLink(shareUrl);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <OntonDialog open={open} onClose={onClose} title="Proof of Attendance">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Badge Hologram Artwork Frame */}
        <div className="relative group w-48 h-48 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.3)] border-2 border-blue-400/40 bg-gradient-to-b from-blue-900/20 via-neutral-900/40 to-black/80 flex items-center justify-center p-2">
          {badgeImage.endsWith(".lottie") || badgeImage.endsWith(".json") ? (
            <div className="text-4xl">🎖️</div>
          ) : (
            <Image
              src={badgeImage}
              alt={badgeTitle}
              width={192}
              height={192}
              className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          )}
          {/* Hologram Sheen */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-transparent mix-blend-overlay" />
        </div>

        {/* TEP-85 Verified Chip */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>TEP-85 Soulbound Credential</span>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-1 w-full">
          <Typography variant="title3" bold className="text-gray-900 dark:text-white line-clamp-2">
            {badgeTitle}
          </Typography>
          <Typography variant="subheadline2" className="text-gray-500 dark:text-gray-400 text-xs line-clamp-3">
            {badgeDescription}
          </Typography>
        </div>

        {/* Event & On-Chain Metadata Table */}
        <div className="w-full flex flex-col gap-2 p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-800 text-left text-xs">
          {badge.eventTitle && (
            <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
              <span className="text-gray-500 dark:text-gray-400">Event</span>
              <span className="font-medium text-gray-900 dark:text-gray-200 truncate max-w-[180px]">
                {badge.eventTitle}
              </span>
            </div>
          )}

          {badge.eventDateFrom && (
            <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
              <span className="text-gray-500 dark:text-gray-400">Date</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                {new Date(badge.eventDateFrom).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
            <span className="text-gray-500 dark:text-gray-400">Network</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {isMainnet ? "TON Mainnet" : "TON Testnet"}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
            <span className="text-gray-500 dark:text-gray-400">SBT Item Address</span>
            <button
              onClick={() => handleCopy(badge.itemAddress, "item")}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-800 dark:text-gray-200 hover:text-blue-600 transition"
              title={badge.itemAddress}
            >
              <span>{truncateAddress(badge.itemAddress)}</span>
              {copiedKey === "item" ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>
          </div>

          {badge.collectionAddress && (
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500 dark:text-gray-400">Collection</span>
              <button
                onClick={() => handleCopy(badge.collectionAddress!, "collection")}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-800 dark:text-gray-200 hover:text-blue-600 transition"
                title={badge.collectionAddress}
              >
                <span>{truncateAddress(badge.collectionAddress)}</span>
                {copiedKey === "collection" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full pt-1">
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Share Badge in Telegram</span>
          </button>

          <button
            onClick={handleOpenExplorer}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200 font-medium text-xs transition"
          >
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            <span>View on Explorer ({isMainnet ? "Tonviewer" : "Testnet Tonviewer"})</span>
          </button>
        </div>
      </div>
    </OntonDialog>
  );
}
