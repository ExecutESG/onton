"use client";

import useWebApp from "@/hooks/useWebApp";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface QrcodeTmaSettingsProps {
  ticketId: string;
}

/** QR code page TMA settings: hides main button, back button returns to ticket pass. */
export default function QrcodeTmaSettings({ ticketId }: QrcodeTmaSettingsProps) {
  const webApp = useWebApp();
  const router = useRouter();

  const handleBackClick = useCallback(() => {
    router.push(`/tickets/${ticketId}`);
  }, [ticketId, router]);

  useEffect(() => {
    if (!webApp) return;
    webApp.MainButton.hide();
    webApp.BackButton.show();
    webApp.BackButton.onClick(handleBackClick);
    return () => {
      webApp.BackButton.hide();
      webApp.BackButton.offClick(handleBackClick);
    };
  }, [webApp, handleBackClick]);

  useEffect(() => {
    if (!webApp) return;
    webApp.setBackgroundColor("#f0f0f0");
    webApp.setHeaderColor("#EFEFF4");
  }, [webApp]);

  return null;
}
