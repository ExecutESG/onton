"use client";

import useWebApp from "@/hooks/useWebApp";
import { Video } from "lucide-react";

interface TicketMeetingButtonProps {
  meetingUrl: string | null | undefined;
}

/** Opens the event's online stream or meeting URL (Zoom, Google Meet, Telegram Live, etc.). */
export function TicketMeetingButton({ meetingUrl }: TicketMeetingButtonProps) {
  const webApp = useWebApp();

  if (!meetingUrl) return null;

  const handleOpenMeeting = () => {
    try {
      if (webApp?.openLink) {
        webApp.openLink(meetingUrl);
        return;
      }
    } catch {
      // Fallback
    }
    if (typeof window !== "undefined") {
      window.open(meetingUrl, "_blank");
    }
  };

  return (
    <button
      onClick={handleOpenMeeting}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white shadow transition-all hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98]"
    >
      <Video className="h-4 w-4" />
      Join Online Meeting
    </button>
  );
}
