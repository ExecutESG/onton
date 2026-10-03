"use client";

import useWebApp from "@/hooks/useWebApp";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface TicketTmaSettingsProps {
  ticketId: string;
  orderUuid: string;
  eventId: string;
}

/** Configures TMA MainButton (Check-in → QR) and BackButton (→ Event page). */
export default function TicketTmaSettings({ ticketId, orderUuid, eventId }: TicketTmaSettingsProps) {
  const webApp = useWebApp();
  const router = useRouter();

  const handleMainClick = useCallback(() => {
    router.push(`/tickets/${ticketId}/qrcode?orderUuid=${orderUuid}`);
  }, [ticketId, orderUuid, router]);

  const handleBackClick = useCallback(() => {
    router.push(`/events/${eventId}`);
  }, [eventId, router]);

  useEffect(() => {
    if (!webApp) return;
    webApp.MainButton.setText("Check-in");
    webApp.MainButton.setParams({ color: "#007AFF", text_color: "#ffffff" });
    webApp.MainButton.show();
    webApp.MainButton.enable();
    webApp.MainButton.onClick(handleMainClick);
    return () => {
      webApp.MainButton.hide();
      webApp.MainButton.offClick(handleMainClick);
    };
  }, [webApp, handleMainClick]);

  useEffect(() => {
    if (!webApp) return;
    webApp.BackButton.show();
    webApp.BackButton.onClick(handleBackClick);
    return () => {
      webApp.BackButton.hide();
      webApp.BackButton.offClick(handleBackClick);
    };
  }, [webApp, handleBackClick]);

  useEffect(() => {
    if (!webApp) return;
    webApp.setBackgroundColor("#ffffff");
    webApp.setHeaderColor("#ffffff");
  }, [webApp]);

  return null;
}
