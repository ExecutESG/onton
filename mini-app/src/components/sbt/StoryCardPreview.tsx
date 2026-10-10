"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { ShieldCheck, Sparkles, Send, Share2 } from "lucide-react";
import useTelegramStory from "@/hooks/useTelegramStory";

interface StoryCardPreviewProps {
  badgeTitle: string;
  badgeImage: string;
  eventTitle: string;
  eventUuid?: string;
  explorerUrl?: string;
  ownerIdentifier?: string;
}

export default function StoryCardPreview({
  badgeTitle,
  badgeImage,
  eventTitle,
  eventUuid,
  explorerUrl,
  ownerIdentifier,
}: StoryCardPreviewProps) {
  const { isStorySupported, shareToStory } = useTelegramStory();
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "notnonstagebot";

  const handleShareStory = () => {
    const deepLink = eventUuid
      ? `https://t.me/${botUsername}/event?startapp=${eventUuid}`
      : `https://t.me/${botUsername}`;

    shareToStory({
      mediaUrl: badgeImage.startsWith("http") ? badgeImage : `https://app.onton.live${badgeImage}`,
      text: `Just collected my official soulbound badge for ${eventTitle}! 🎟️✨\n\nVerified on TON Blockchain.`,
      widgetLink: {
        url: deepLink,
        name: "View Event on ONTON",
      },
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* 9:16 Story Visual Canvas */}
      <div className="relative w-full aspect-[9/16] rounded-3xl overflow-hidden bg-gradient-to-b from-neutral-950 via-slate-900 to-indigo-950 p-6 flex flex-col justify-between items-center text-center shadow-2xl border border-white/10 select-none">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amber-300 text-xs font-semibold tracking-wide shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>OFFICIAL ATTENDEE CREDENTIAL</span>
          </div>
          <span className="text-[11px] text-gray-400 font-medium">ONTON SOVEREIGN SBT</span>
        </div>

        {/* Central Artwork Showcase */}
        <div className="relative z-10 flex flex-col items-center my-auto">
          <div className="relative w-44 h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/40 backdrop-blur-sm p-2 flex items-center justify-center group">
            {badgeImage ? (
              <Image
                src={badgeImage}
                alt={badgeTitle}
                width={176}
                height={176}
                className="w-full h-full object-contain rounded-xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                priority
              />
            ) : (
              <span className="text-6xl">🎖️</span>
            )}
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border-2 border-slate-900">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <h2 className="mt-5 text-xl font-bold text-white px-2 leading-snug line-clamp-2">
            {badgeTitle}
          </h2>
          <p className="mt-1 text-xs text-blue-300 font-medium px-4 line-clamp-1">
            {eventTitle}
          </p>

          {ownerIdentifier && (
            <div className="mt-3 text-[11px] text-gray-400 font-mono bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
              Held by {ownerIdentifier}
            </div>
          )}
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 w-full pt-4 border-t border-white/10 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Verified on TON Blockchain</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono tracking-wider">
            @{botUsername} • ONTON.LIVE
          </span>
        </div>
      </div>

      {/* Share Actions */}
      <div className="w-full mt-4 flex flex-col gap-2">
        <button
          onClick={handleShareStory}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/25 active:scale-[0.98]"
        >
          <Share2 className="w-4 h-4" />
          <span>Share to Telegram Story 📱</span>
        </button>
      </div>
    </div>
  );
}
