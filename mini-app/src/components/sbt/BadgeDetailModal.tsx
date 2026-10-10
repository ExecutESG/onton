"use client";

import React, { useState } from "react";
import Image from "next/image";
import OntonDialog from "@/components/OntonDialog";
import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import { toast } from "sonner";
import { Award, Check, Copy, ExternalLink, Send, ShieldCheck, Share2, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import useTelegramStory from "@/hooks/useTelegramStory";
import StoryCardPreview from "./StoryCardPreview";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, toNano } from "@ton/core";
import { SBT_ONCHAIN_UPGRADE_PRICE } from "@/constants";
import { trpc } from "@/app/_trpc/client";

export interface BadgeItemData {
  id?: number | string;
  itemAddress?: string | null;
  collectionAddress?: string | null;
  collectionName?: string | null;
  itemIndex?: number;
  metadata?: any;
  metadataJson?: any;
  metadataUri?: string | null;
  explorerUrl?: string;
  createdAt?: string | Date | null;
  eventUuid?: string | null;
  eventTitle?: string | null;
  eventImage?: string | null;
  eventDateFrom?: string | Date | null;
  eventDateTo?: string | Date | null;
  eventLocation?: string | null;
  eventParticipationType?: string | null;
  isTonSociety?: boolean;
  issuer?: string;
  network?: string;
  rewardLink?: string | null;
  kind?: "native_sbt" | "legacy_onchain" | "legacy_record";
  canUpgrade?: boolean;
  rewardId?: string | null;
}

interface BadgeDetailModalProps {
  badge: BadgeItemData | null;
  open: boolean;
  onClose: () => void;
  onUpgradeSuccess?: () => void;
}

function truncateAddress(addr?: string | null): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

export function parseDate(d: string | Date | number | null | undefined): Date | null {
  if (!d) return null;
  if (typeof d === "number") {
    return new Date(d > 1e11 ? d : d * 1000);
  }
  const dateObj = new Date(d);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

export default function BadgeDetailModal({ badge, open, onClose, onUpgradeSuccess }: BadgeDetailModalProps) {
  const webApp = useWebApp();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showStoryCard, setShowStoryCard] = useState(false);
  const { shareToStory } = useTelegramStory();
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "notnonstagebot";

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<string>("");

  const { data: treasuryConfig } = trpc.sbt.getTreasuryConfig.useQuery(undefined, {
    enabled: open && Boolean(badge?.canUpgrade || badge?.kind === "legacy_record"),
  });

  const upgradeMutation = trpc.sbt.materializeLegacyRecord.useMutation({
    onSuccess: (data) => {
      setIsUpgrading(false);
      setUpgradeStep("");
      toast.success("TEP-85 Soulbound Token minted to your wallet!");
      if (badge) {
        badge.itemAddress = data.itemAddress;
        badge.explorerUrl = data.explorerUrl;
        badge.kind = "legacy_onchain";
        badge.canUpgrade = false;
      }
      onUpgradeSuccess?.();
    },
    onError: (err) => {
      setIsUpgrading(false);
      setUpgradeStep("");
      toast.error(err.message || "Failed to upgrade badge to on-chain");
    },
  });

  const handleUpgradeToOnChain = async () => {
    if (!badge?.rewardId) {
      toast.error("Reward identifier missing for upgrade.");
      return;
    }

    const userWallet = wallet?.account?.address;
    if (!userWallet) {
      toast.info("Please connect your TON wallet to upgrade to an on-chain token.");
      tonConnectUI.openModal();
      return;
    }

    const effectiveTreasuryAddress = treasuryConfig?.treasuryAddress;
    if (!effectiveTreasuryAddress && process.env.NEXT_PUBLIC_ENV !== "local") {
      toast.error("Treasury wallet not configured. Please try again later.");
      return;
    }

    try {
      setIsUpgrading(true);
      setUpgradeStep("Awaiting wallet approval...");

      const body = beginCell()
        .storeUint(0, 32)
        .storeStringTail(`sbt_upgrade_legacy:${badge.rewardId}`)
        .endCell()
        .toBoc();

      if (effectiveTreasuryAddress) {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [
            {
              address: effectiveTreasuryAddress,
              amount: toNano(String(treasuryConfig?.upgradePriceTon || SBT_ONCHAIN_UPGRADE_PRICE)).toString(),
              payload: body.toString("base64"),
            },
          ],
        });
      }

      setUpgradeStep("Verifying payment & minting token...");
      upgradeMutation.mutate({
        rewardId: badge.rewardId,
        walletAddress: userWallet,
      });
    } catch (err: unknown) {
      setIsUpgrading(false);
      setUpgradeStep("");
      const message = err instanceof Error ? err.message : "Transaction cancelled or failed";
      const lower = message.toLowerCase();
      if (!lower.includes("cancel") && !lower.includes("reject")) {
        toast.error(message);
      } else {
        toast.info("Transaction cancelled");
      }
    }
  };

  React.useEffect(() => {
    if (!open) {
      setShowStoryCard(false);
      setIsUpgrading(false);
      setUpgradeStep("");
    }
  }, [open]);

  if (!badge) return null;

  const isMainnet = badge.network
    ? badge.network === "TON Mainnet"
    : badge.explorerUrl
      ? !badge.explorerUrl.includes("testnet")
      : process.env.NEXT_PUBLIC_ENV === "production";

  const explorerUrl =
    badge.explorerUrl ||
    (badge.itemAddress
      ? `https://${isMainnet ? "tonviewer.com" : "testnet.tonviewer.com"}/${badge.itemAddress}`
      : badge.rewardLink || "#");

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
      `🎖️ I earned my Proof of Attendance badge for "${badge.eventTitle || badgeTitle}" on ONTON!${badge.itemAddress ? `\n\nContract: ${badge.itemAddress}` : ""}`
    );
    const shareLink = badge.itemAddress
      ? `https://${isMainnet ? "tonviewer.com" : "testnet.tonviewer.com"}/${badge.itemAddress}`
      : (badge.eventUuid ? `https://t.me/${botUsername}/event?startapp=${badge.eventUuid}` : `https://t.me/${botUsername}`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${text}`;
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

  const handleShareStory = () => {
    const deepLink = badge.eventUuid
      ? `https://t.me/${botUsername}/event?startapp=${badge.eventUuid}`
      : `https://t.me/${botUsername}`;

    shareToStory({
      mediaUrl: badgeImage.startsWith("http") ? badgeImage : `https://app.onton.live${badgeImage}`,
      text: `Just collected my official soulbound badge for ${badge.eventTitle || badgeTitle}! 🎟️✨`,
      widgetLink: {
        url: deepLink,
        name: "View Event on ONTON",
      },
    });
  };

  return (
    <OntonDialog
      open={open}
      onClose={onClose}
      title={showStoryCard ? "Telegram Story Preview" : "Proof of Attendance"}
    >
      {showStoryCard ? (
        <div className="flex flex-col items-center w-full">
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <button
              onClick={() => setShowStoryCard(false)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Details</span>
            </button>
            <span className="text-xs font-semibold text-blue-500">9:16 Story Card</span>
          </div>

          <StoryCardPreview
            badgeTitle={badgeTitle}
            badgeImage={badgeImage}
            eventTitle={badge.eventTitle || badgeTitle}
            eventUuid={badge.eventUuid || undefined}
            explorerUrl={explorerUrl}
            ownerIdentifier={badge.itemAddress ? truncateAddress(badge.itemAddress) : undefined}
          />
        </div>
      ) : (
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

        {/* Verification Provenance Chip */}
        {badge.kind === "legacy_onchain" ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-semibold">
            <Award className="w-3.5 h-3.5" />
            <span>On-chain (legacy)</span>
          </div>
        ) : badge.kind === "legacy_record" || (!badge.itemAddress && !badge.kind) ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
            <Award className="w-3.5 h-3.5" />
            <span>Attendance record (legacy)</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>TEP-85 Soulbound Credential</span>
          </div>
        )}

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

          {parseDate(badge.eventDateFrom) && (
            <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
              <span className="text-gray-500 dark:text-gray-400">Date</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                {parseDate(badge.eventDateFrom)!.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}

          {badge.eventParticipationType && (
            <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
              <span className="text-gray-500 dark:text-gray-400">Participation</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                {badge.eventParticipationType === "in_person" ? "In-Person" : "Online"}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
            <span className="text-gray-500 dark:text-gray-400">Issuer</span>
            <span className="font-medium text-gray-900 dark:text-gray-200">
              {badge.issuer || "ONTON"}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
            <span className="text-gray-500 dark:text-gray-400">Network</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {badge.network || (isMainnet ? "TON Mainnet" : "TON Testnet")}
            </span>
          </div>

          {badge.itemAddress ? (
            <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-700/50">
              <span className="text-gray-500 dark:text-gray-400">SBT Item Address</span>
              <button
                onClick={() => handleCopy(badge.itemAddress!, "item")}
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
          ) : null}

          {badge.collectionAddress ? (
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
          ) : badge.collectionName ? (
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500 dark:text-gray-400">Collection</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                {badge.collectionName}
              </span>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full pt-1">
          {(badge.kind === "legacy_record" || badge.canUpgrade) && (
            <button
              onClick={handleUpgradeToOnChain}
              disabled={isUpgrading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-xs transition shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{upgradeStep || "Upgrading to On-Chain SBT..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upgrade to On-Chain SBT ({treasuryConfig?.upgradePriceTon || SBT_ONCHAIN_UPGRADE_PRICE} TON)</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleShareStory}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium text-xs transition shadow-sm active:scale-[0.98]"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share to Telegram Story 📱</span>
          </button>

          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={() => setShowStoryCard(true)}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-medium text-xs transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Story Card</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-medium text-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share in Chat</span>
            </button>
          </div>

          {explorerUrl && explorerUrl !== "#" && (
            <button
              onClick={handleOpenExplorer}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-200 font-medium text-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              <span>
                {badge.itemAddress
                  ? `View on Explorer (${isMainnet ? "Tonviewer" : "Testnet Tonviewer"})`
                  : "View Credential"}
              </span>
            </button>
          )}
        </div>
      </div>
      )}
    </OntonDialog>
  );
}
