import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "@mantine/hooks";
import { PARTNER_HASH_LOCAL_KEY, PARTNER_HASH_SEARCH_PARAM_KEY } from "@/constants";

/**
 * Hook that
 *  • syncs ?affp=… to localStorage
 *  • exposes inviteOnTelegram(url) which opens the Telegram share‑to‑contact sheet
 */
export const usePartnershipAffiliate = () => {
  const searchParams = useSearchParams();
  const hashFromQuery = searchParams.get(PARTNER_HASH_SEARCH_PARAM_KEY)?.trim();

  const [partnerHash, setPartnerHash] = useLocalStorage<string | null>({
    key: PARTNER_HASH_LOCAL_KEY,
  });

  /* state for UI spinners */
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<boolean>(false);

  /* keep query‑param in localStorage */
  useEffect(() => {
    if (hashFromQuery && hashFromQuery !== partnerHash) {
      setPartnerHash(hashFromQuery);
    }
  }, [hashFromQuery, partnerHash, setPartnerHash]);

  /**
   * Opens Telegram’s “Select chat or contact” sheet with a pre‑filled message.
   * Falls back to navigator.share or clipboard when run outside Telegram.
   */
  const inviteOnTelegram = useCallback(async (url: string) => {
    setShareError(false);
    setIsSharing(true);

    const text = `Join ONTON via my partnership link and get perks! ${url}`;

    try {
      /* If running inside Telegram Mini‑App */
      if (window.Telegram?.WebApp?.openTelegramLink) {
        const deep = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.Telegram.WebApp.openTelegramLink(deep);
      } else if (navigator.share) {
      /* Outside Telegram but Web‑Share‑API available */
        await navigator.share({ title: "ONTON Fairlaunch", text, url });
      } else {
      /* Final fallback – copy */
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.error("inviteOnTelegram error:", err);
      setShareError(true);
      throw err;
    } finally {
      setIsSharing(false);
    }
  }, []);

  return {
    partnerHash,
    resetPartnerHash: () => setPartnerHash(null),
    inviteOnTelegram,
    isSharing,
    shareError,
  };
};
