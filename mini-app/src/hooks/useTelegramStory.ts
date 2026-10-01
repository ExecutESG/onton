"use client";

import useWebApp from "@/hooks/useWebApp";
import { useCallback } from "react";

export interface ShareToStoryOptions {
  mediaUrl: string;
  text?: string;
  widgetLink?: {
    url: string;
    name?: string;
  };
}

export function useTelegramStory() {
  const webApp = useWebApp();

  const isStorySupported = Boolean(
    (webApp as any)?.shareToStory ||
      (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.shareToStory)
  );

  const shareToStory = useCallback(
    (options: ShareToStoryOptions): boolean => {
      const wa = (webApp as any) || (typeof window !== "undefined" ? (window as any).Telegram?.WebApp : null);

      if (wa?.HapticFeedback?.impactOccurred) {
        try {
          wa.HapticFeedback.impactOccurred("medium");
        } catch (_) {}
      }

      if (wa && typeof wa.shareToStory === "function") {
        try {
          wa.shareToStory(options.mediaUrl, {
            text: options.text,
            widget_link: options.widgetLink,
          });
          return true;
        } catch (err) {
          console.error("Telegram shareToStory failed, invoking fallback:", err);
        }
      }

      // Universal Fallback: Native Telegram Chat Share
      const shareUrl = options.widgetLink?.url || options.mediaUrl;
      const shareText = encodeURIComponent(
        `${options.text || "Check out my soulbound attendance credential on ONTON! 🎖️✨"}`
      );
      const fallbackUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`;

      if (wa?.openTelegramLink) {
        wa.openTelegramLink(fallbackUrl);
      } else if (wa?.openLink) {
        wa.openLink(fallbackUrl);
      } else if (typeof window !== "undefined") {
        window.open(fallbackUrl, "_blank");
      }

      return false;
    },
    [webApp]
  );

  return {
    isStorySupported,
    shareToStory,
  };
}

export default useTelegramStory;
