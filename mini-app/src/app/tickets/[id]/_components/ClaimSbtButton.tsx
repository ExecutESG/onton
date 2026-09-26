"use client";

import useWebApp from "@/hooks/useWebApp";
import { FiAward } from "react-icons/fi";

interface ClaimSbtButtonProps {
  rewardLink: string;
}

/** Opens the SBT reward claim link via Telegram. */
export function ClaimSbtButton({ rewardLink }: ClaimSbtButtonProps) {
  const webApp = useWebApp();

  const handleClaim = () => {
    try {
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(rewardLink);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(rewardLink, "_blank");
    }
  };

  return (
    <button
      onClick={handleClaim}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow transition-all hover:from-purple-600 hover:to-indigo-700 active:scale-[0.98]"
    >
      <FiAward className="h-4 w-4" />
      Claim SBT Badge
    </button>
  );
}
