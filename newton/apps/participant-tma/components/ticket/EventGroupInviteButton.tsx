"use client";

import { useUtils } from "@tma.js/sdk-react";
import { Button } from "@ui/base/button";
import React from "react";
import { FaTelegramPlane } from "react-icons/fa";

interface EventGroupInviteButtonProps {
  inviteLink: string;
}

export const EventGroupInviteButton: React.FC<EventGroupInviteButtonProps> = ({ inviteLink }) => {
  const tmaUtils = useUtils(true);

  const handleJoin = () => {
    if (!inviteLink) return;
    try {
      if (tmaUtils?.openTelegramLink) {
        tmaUtils.openTelegramLink(inviteLink);
        return;
      }
    } catch {
      // TMA openTelegramLink fallback
    }

    if (typeof window !== "undefined") {
      window.open(inviteLink, "_blank");
    }
  };

  return (
    <Button
      onClick={handleJoin}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#24A1DE] py-3 text-sm font-semibold text-white shadow transition-all hover:bg-[#1f8ec3] active:scale-[0.98]"
    >
      <FaTelegramPlane className="h-4 w-4" />
      Join Official Event Chat
    </Button>
  );
};
