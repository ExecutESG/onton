"use client";

import { useUtils } from "@tma.js/sdk-react";
import { Button } from "@ui/base/button";
import React from "react";
import { FiShare2 } from "react-icons/fi";

interface ShareTicketButtonProps {
  eventUuid: string;
  eventTitle?: string;
}

export const ShareTicketButton: React.FC<ShareTicketButtonProps> = ({
  eventUuid,
  eventTitle,
}) => {
  const tmaUtils = useUtils(true);

  const handleShare = () => {
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "theontonbot";
    const shareUrl = `https://t.me/${botUsername}/event?startapp=${eventUuid}`;
    const text = encodeURIComponent(
      `🎟️ I just got my pass for ${eventTitle || "this event"} on ONTON! Join me here:`
    );
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`;

    try {
      if (tmaUtils?.openTelegramLink) {
        tmaUtils.openTelegramLink(telegramShareUrl);
        return;
      }
    } catch {
      // Fallback
    }

    if (typeof window !== "undefined") {
      window.open(telegramShareUrl, "_blank");
    }
  };

  return (
    <Button
      onClick={handleShare}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98]"
    >
      <FiShare2 className="h-4 w-4" />
      Invite Friends to Event
    </Button>
  );
};
