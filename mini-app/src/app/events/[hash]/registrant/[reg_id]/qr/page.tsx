"use client";

import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";
import RegistrantCheckInQrCode from "@/app/_components/Event/RegistrantCheckInQrCode";
import { useGetEvent } from "@/hooks/events.hooks";
import useWebApp from "@/hooks/useWebApp";
import { ChevronLeft } from "lucide-react";
import { Block, BlockHeader, BlockTitle } from "konsta/react";
import { useParams, useRouter } from "next/navigation";

export default function RegistrantQrCodePage() {
  const params = useParams<{
    hash: string;
    reg_id: string;
  }>();

  const webApp = useWebApp();
  const router = useRouter();
  const { data: eventData } = useGetEvent(params.hash);

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen flex flex-col justify-between">
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-4 hover:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Event
        </button>

        <BlockTitle className="!px-0">{eventData?.title ? eventData.title : "Check-in QR Code"}</BlockTitle>
        <BlockHeader className="!px-0 text-xs text-gray-500">
          Please show this QR pass to the event organizers to check-in at the venue.
        </BlockHeader>

        <Block
          className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 flex flex-col items-center mt-4"
          style={{
            paddingBlock: webApp?.viewportHeight ? webApp.viewportHeight / 15 : 24,
          }}
        >
          <RegistrantCheckInQrCode registrant_uuid={params.reg_id} />
          <span className="text-[11px] font-mono text-gray-400 mt-4">Pass ID: {params.reg_id.slice(0, 8)}...</span>
        </Block>
      </div>

      <div className="mt-8">
        <button
          onClick={() => router.back()}
          className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-semibold text-sm transition"
        >
          Back To Event Page
        </button>
      </div>

      <MainButton
        text="Back To Event Page"
        onClick={() => {
          router.back();
        }}
      />
    </div>
  );
}
