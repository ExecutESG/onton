"use client";

import React, { useRef } from "react";
import OntonDialog from "@/components/OntonDialog";
import { useLoginStore } from "@/context/store/login.store";
import { TonConnectButton } from "@tonconnect/ui-react";

export default function WebLoginSheet() {
  const { isOpen, closeLogin } = useLoginStore();

  return (
    <OntonDialog
      open={isOpen}
      onClose={closeLogin}
      title="Sign in to ONTON"
    >
      <div className="flex flex-col gap-6 py-4 items-center w-full">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          Discover and access events on TON. Choose a method below to sign in.
        </p>

        {/* Telegram Widget */}
        <div className="flex flex-col gap-2 w-full max-w-xs items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telegram Portal</span>
          <TelegramWidgetButton />
        </div>

        <div className="w-full max-w-xs border-t border-gray-200 dark:border-gray-700 my-2" />

        {/* Web3 Wallet */}
        <div className="flex flex-col gap-2 w-full max-w-xs items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Web3 Connect</span>
          <div className="scale-105">
            <TonConnectButton />
          </div>
        </div>

        <div className="w-full max-w-xs border-t border-gray-200 dark:border-gray-700 my-2" />

        {/* Web2 Socials */}
        <div className="flex flex-col gap-2 w-full max-w-xs items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Web2 Sign In</span>
          <button
            onClick={() => {
              window.location.href = "/api/auth/google/web";
            }}
            className="flex items-center justify-center gap-3 w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium py-2.5 px-4 rounded-xl shadow-sm transition-all text-sm"
          >
            {/* Google SVG Icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.85-.94 2.4l3.07 2.38c1.8-1.66 2.92-4.11 2.92-6.63z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.07-2.38c-.9.6-2.03.96-3.23.96-2.48 0-4.58-1.67-5.33-3.92l-3.18 2.46C7.1 21.8 11.24 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M6.67 15.75c-.2-.6-.31-1.25-.31-1.92s.11-1.32.31-1.92L3.49 9.45C2.65 11.13 2.18 13.01 2.18 15s.47 3.87 1.31 5.55l3.18-2.46C5.92 17.02 5.92 16.73 6.67 15.75z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.9 0 4.39 2.2 2.18 5.45l3.18 2.46c.75-2.25 2.85-3.92 5.33-3.92z"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </OntonDialog>
  );
}

function TelegramWidgetButton() {
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_BOT_USERNAME || "onton_bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-auth-url", `${window.location.origin}/api/auth/telegram-widget`);
    script.setAttribute("data-request-access", "write");
    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(script);
    }
  }, []);

  return <div ref={containerRef} className="flex justify-center min-h-[40px]" />;
}
