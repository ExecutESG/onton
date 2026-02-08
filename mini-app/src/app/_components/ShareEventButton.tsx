"use client";

import { trpc } from "@/app/_trpc/client";
import useWebApp from "@/hooks/useWebApp";
import { cn, wait } from "@/lib/utils";
import { LoaderIcon, LucideShare2 } from "lucide-react";

const ShareEventButton = ({
  event_uuid,
  activity_id,
  hidden,
}: {
  event_uuid: string;
  activity_id: number | null | undefined;
  hidden: boolean | null | undefined;
}) => {
  const WebApp = useWebApp();
  const initData = WebApp?.initData || "";
  const hapticFeedback = WebApp?.HapticFeedback;

  const shareEventMutation = trpc.telegramInteractions.requestShareEvent.useMutation();

  return (
    <button
      className={cn(
        "w-9 h-9 justify-self-end flex items-center justify-center rounded-lg bg-brand-fill-bg/15 disabled:opacity-20 disabled:cursor-not-allowed",
        shareEventMutation.isLoading && Boolean(initData) && "opacity-50"
      )}
      disabled={!initData || shareEventMutation.isLoading || !activity_id || !!hidden}
      onClick={async (e) => {
        e.preventDefault();
        if (!initData) return;

        await shareEventMutation.mutateAsync({
          eventUuid: event_uuid,
        });

        // Add the logic for the platform or sharing link
        WebApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`);
        hapticFeedback?.impactOccurred("medium");
        await wait(500);
        WebApp?.close();
      }}
    >
      {shareEventMutation.isLoading ? <LoaderIcon className="animate-spin" /> : <LucideShare2 className="text-lg" />}
    </button>
  );
};

export default ShareEventButton;
