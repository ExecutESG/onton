"use client";

import { useState } from "react";
import useWebApp from "@/hooks/useWebApp";
import { FaTelegramPlane } from "react-icons/fa";
import { FiCheck, FiCopy } from "react-icons/fi";
import { toast } from "sonner";

interface TicketGroupInviteButtonProps {
  inviteLink: string | null | undefined;
}

/** Opens the event's official Telegram group chat via invite link. */
export function TicketGroupInviteButton({ inviteLink }: TicketGroupInviteButtonProps) {
  const webApp = useWebApp();
  const [copied, setCopied] = useState(false);

  if (!inviteLink) return null;

  const handleJoin = () => {
    try {
      const isTgLink = /^https?:\/\/(t\.me|telegram\.me)\//i.test(inviteLink) || /^tg:\/\//i.test(inviteLink);
      if (isTgLink && webApp?.openTelegramLink) {
        webApp.openTelegramLink(inviteLink);
        setTimeout(() => {
          webApp?.close();
        }, 250);
        return;
      }
      if (webApp?.openLink) {
        webApp.openLink(inviteLink);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(inviteLink, "_blank");
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let copiedSuccess = false;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        copiedSuccess = true;
      } catch {
        // Fall back to execCommand if Clipboard API is restricted in webview
      }
    }

    if (!copiedSuccess && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = inviteLink;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copiedSuccess = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copiedSuccess = false;
      }
    }

    if (copiedSuccess) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Chat invite link copied!");
    } else {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleJoin}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#24A1DE] py-3 text-sm font-semibold text-white shadow transition-all hover:bg-[#1f8ec3] active:scale-[0.98]"
      >
        <FaTelegramPlane className="h-4 w-4" />
        Join Official Event Chat
      </button>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy invite link"
        aria-label="Copy invite link"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
      >
        {copied ? <FiCheck className="h-4 w-4 text-emerald-600" /> : <FiCopy className="h-4 w-4" />}
      </button>
    </div>
  );
}

