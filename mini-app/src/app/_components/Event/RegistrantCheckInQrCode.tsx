import React, { useEffect, useRef, useState } from "react";
import QRCodeStyling, { Options } from "qr-code-styling";
import { trpc } from "@/app/_trpc/client";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface RegistrantCheckInQrCodeProps {
  registrant_uuid: string;
}

/**
 * Free event in-person registrant check in dynamic QR pass
 * @param registrant_uuid - uuid of the registrant
 */
const RegistrantCheckInQrCode = (props: RegistrantCheckInQrCodeProps) => {
  const [countdown, setCountdown] = useState<number>(20);

  const tokenQuery = trpc.registrant.getRegistrantQrToken.useQuery(
    { registrant_uuid: props.registrant_uuid },
    {
      enabled: !!props.registrant_uuid,
      refetchInterval: 12000,
      refetchOnWindowFocus: true,
    }
  );

  const activeToken = tokenQuery.data?.token || props.registrant_uuid;

  useEffect(() => {
    if (tokenQuery.data) {
      setCountdown(tokenQuery.data.remainingSeconds);
    }
  }, [tokenQuery.data]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [options] = useState<Options>({
    type: "svg",
    data: activeToken,
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "Q",
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 20,
      crossOrigin: "anonymous",
    },
  });

  const qrCodeRef = useRef<QRCodeStyling | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!qrCodeRef.current) {
      qrCodeRef.current = new QRCodeStyling(options);
      if (ref.current) {
        qrCodeRef.current.append(ref.current);
      }
    }
  }, [options]);

  useEffect(() => {
    if (qrCodeRef.current && activeToken) {
      qrCodeRef.current.update({ data: activeToken });
    }
  }, [activeToken]);

  const progressPercent = Math.min(100, Math.max(0, (countdown / 20) * 100));

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
        <ShieldCheck className="h-3 w-3" />
        <span>Dynamic Rotating Pass</span>
      </div>

      <div className="[&>*]:w-full w-full" ref={ref} />

      <div className="mt-3 w-full px-2">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className={`h-2.5 w-2.5 ${countdown <= 3 ? "animate-spin text-amber-500" : ""}`} />
            <span>Refreshes in</span>
          </span>
          <span className="font-mono">{countdown}s</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              countdown <= 4 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default RegistrantCheckInQrCode;
