"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Options } from "qr-code-styling";
import QrcodeTmaSettings from "../_components/QrcodeTmaSettings";
import options from "./options.json";

type Props = { params: { id: string } };

/** Full-screen QR code check-in page with TON logo overlay. */
export default function QrcodePage({ params }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<InstanceType<typeof import("qr-code-styling").default> | null>(null);
  const searchParams = useSearchParams();
  const orderUuid = searchParams.get("orderUuid");

  useEffect(() => {
    if (!qrRef.current || !orderUuid) return;

    const initQr = async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      const qrOptions = { ...options, data: orderUuid } as unknown as Options;
      const qrCode = new QRCodeStyling(qrOptions);
      qrInstanceRef.current = qrCode;

      if (qrRef.current) {
        qrRef.current.innerHTML = "";
        qrCode.append(qrRef.current);
        const canvas = qrRef.current.querySelector("canvas");
        if (canvas) {
          canvas.style.width = "100%";
        }
      }
    };

    initQr();
  }, [orderUuid]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#f0f0f0] px-4">
      <h1 className="mb-11 mt-10 text-center text-xl font-bold">
        Show the QR code to check in to the event
      </h1>

      <div className="relative grid aspect-square w-full max-w-sm place-items-center rounded-[20px] bg-white p-7">
        <Image
          priority
          src="/TON.svg"
          alt="TON"
          width={64}
          height={64}
          className="absolute left-1/2 top-1/2 z-10 h-[18vw] w-[18vw] max-h-16 max-w-16 -translate-x-1/2 -translate-y-1/2"
        />
        <div ref={qrRef} className="relative z-[5] w-full object-contain" />
      </div>

      <QrcodeTmaSettings ticketId={params.id} />
    </div>
  );
}
