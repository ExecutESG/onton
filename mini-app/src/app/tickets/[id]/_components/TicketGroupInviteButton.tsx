"use client";

import useWebApp from "@/hooks/useWebApp";
import { FaTelegramPlane } from "react-icons/fa";

interface TicketGroupInviteButtonProps {
  inviteLink: string | null | undefined;
}

/** Opens the event's official Telegram group chat via invite link. */
export function TicketGroupInviteButton({ inviteLink }: TicketGroupInviteButtonProps) {
  const webApp = useWebApp();

  if (!inviteLink) return null;

  const handleJoin = () => {
    try {
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(inviteLink);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(inviteLink, "_blank");
    }
  };

  return (
    <button
      onClick={handleJoin}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#24A1DE] py-3 text-sm font-semibold text-white shadow transition-all hover:bg-[#1f8ec3] active:scale-[0.98]"
    >
      <FaTelegramPlane className="h-4 w-4" />
      Join Official Event Chat
    </button>
  );
}
