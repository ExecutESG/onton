"use client";

import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";
import RegistrantCheckInQrCode from "@/app/_components/Event/RegistrantCheckInQrCode";
import useWebApp from "@/hooks/useWebApp";
import { Block, BlockHeader, BlockTitle } from "konsta/react";
import { useParams, useRouter } from "next/navigation";

export default function RegistrantQrCodePage() {
  const params = useParams<{
    hash: string;
    reg_id: string;
  }>();

  const webApp = useWebApp();
  const router = useRouter();

  return (
    <div>
      <BlockTitle>Check-in QR Code</BlockTitle>
      <BlockHeader>Please show this QR code to the event organizers to check-in.</BlockHeader>
      <Block
        style={{
          paddingBlock: webApp?.viewportHeight ? webApp.viewportHeight / 10 : 0,
        }}
      >
        <RegistrantCheckInQrCode registrant_uuid={params.reg_id} />
      </Block>
      <MainButton
        text="Back To Event Page"
        onClick={() => {
          router.back();
        }}
      />
    </div>
  );
}
