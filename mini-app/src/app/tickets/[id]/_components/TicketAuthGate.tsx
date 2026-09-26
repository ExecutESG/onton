"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useWebApp from "@/hooks/useWebApp";
import { Loader2 } from "lucide-react";

export default function TicketAuthGate({ eventId }: { eventId: string }) {
  const webApp = useWebApp();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const rawInit =
      webApp?.initData ||
      (typeof window !== "undefined" ? sessionStorage.getItem("telegram:initParams") : "") ||
      "";

    if (!rawInit) {
      setFailed(true);
      return;
    }

    fetch("/api/v1/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_data: rawInit }),
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          router.refresh();
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
  }, [webApp?.initData, router]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f0f0] px-4 text-center">
        <p className="text-lg font-semibold text-gray-800">Authentication Required</p>
        <p className="mt-2 text-sm text-gray-500">Please open this page through the Telegram bot.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f0f0] px-4 text-center">
      <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-gray-600">Loading your ticket pass...</p>
    </div>
  );
}
