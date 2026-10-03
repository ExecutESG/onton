"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Options } from "qr-code-styling";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import QrcodeTmaSettings from "../_components/QrcodeTmaSettings";
import options from "./options.json";

type Props = { params: { id: string } };

/** Full-screen dynamic rotating TOTP QR code check-in page with live anti-fraud protection. */
export default function QrcodePage({ params }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<InstanceType<typeof import("qr-code-styling").default> | null>(null);
  const searchParams = useSearchParams();
  const orderUuid = searchParams.get("orderUuid");

  const [countdown, setCountdown] = useState<number>(20);

  // Fetch dynamic rotating pass token every 12 seconds
  const tokenQuery = trpc.ticket.getTicketQrToken.useQuery(
    { ticketUuid: orderUuid || "" },
    {
      enabled: !!orderUuid,
      refetchInterval: 12000,
      refetchOnWindowFocus: true,
    }
  );

  const activeToken = tokenQuery.data?.token ?? "";
  const remainingSec = tokenQuery.data?.remainingSeconds ?? 20;

  // Sync remaining seconds
  useEffect(() => {
    if (tokenQuery.data) {
      setCountdown(tokenQuery.data.remainingSeconds);
    }
  }, [tokenQuery.data]);

  // 1-second interval countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize or update QR styling
  useEffect(() => {
    if (!qrRef.current || !activeToken) return;

    const initOrUpdateQr = async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;

      if (!qrInstanceRef.current) {
        const qrOptions = { ...options, data: activeToken } as unknown as Options;
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
      } else {
        qrInstanceRef.current.update({ data: activeToken });
      }
    };

    initOrUpdateQr();
  }, [activeToken]);

  const progressPercent = Math.min(100, Math.max(0, (countdown / 20) * 100));

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#f0f0f0] px-4">
      <div className="mt-8 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Live Anti-Fraud Pass</span>
        </div>

        <h1 className="mt-3 text-xl font-bold text-gray-900">
          Show QR Code to Check In
        </h1>
        <p className="mt-1 text-xs text-gray-500 max-w-xs">
          Pass dynamically rotates every 20 seconds to prevent unauthorized screenshots and gate fraud.
        </p>
      </div>

      <div className="relative mt-6 grid aspect-square w-full max-w-sm place-items-center rounded-[24px] bg-white p-6 shadow-sm border border-gray-100">
        <Image
          priority
          src="/TON.svg"
          alt="TON"
          width={64}
          height={64}
          className="absolute left-1/2 top-1/2 z-10 h-[18vw] w-[18vw] max-h-16 max-w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-md"
        />
        <div ref={qrRef} className="relative z-[5] w-full object-contain" />
      </div>

      {/* Freshness Countdown Bar */}
      <div className="mt-5 w-full max-w-sm px-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className={`h-3 w-3 ${countdown <= 3 ? "animate-spin text-amber-500" : ""}`} />
            <span>Pass refreshes in</span>
          </span>
          <span className="font-mono font-medium text-gray-800">{countdown}s</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              countdown <= 4 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <QrcodeTmaSettings ticketId={params.id} />
    </div>
  );
}
