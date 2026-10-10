"use client";

import usePlatformBridge from "@/lib/platform/usePlatformBridge";
import { Loader2 } from "lucide-react";
import React from "react";

export const WebMainButton: React.FC = () => {
  const { isTelegram, mainButton, hapticFeedback } = usePlatformBridge();

  // If in native Telegram, Telegram renders its own MainButton native control
  if (isTelegram || !mainButton.isVisible) {
    return null;
  }

  const handleClick = () => {
    if (!mainButton.isActive || mainButton.isLoading) return;
    hapticFeedback("impact", "medium");
    if (mainButton.onClick) {
      mainButton.onClick();
    }
  };

  const backgroundColor = mainButton.color || "#2481cc";
  const textColor = mainButton.textColor || "#ffffff";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none flex justify-center">
      <div className="w-full max-w-md pointer-events-auto">
        <button
          type="button"
          onClick={handleClick}
          disabled={!mainButton.isActive || mainButton.isLoading}
          style={{
            backgroundColor: mainButton.isActive ? backgroundColor : "#8e8e93",
            color: textColor,
          }}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold shadow-lg transition-all transform active:scale-98 flex items-center justify-center gap-2 ${
            !mainButton.isActive || mainButton.isLoading
              ? "opacity-60 cursor-not-allowed"
              : "hover:brightness-105"
          }`}
        >
          {mainButton.isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          <span>{mainButton.text}</span>
        </button>
      </div>
    </div>
  );
};

export default WebMainButton;
