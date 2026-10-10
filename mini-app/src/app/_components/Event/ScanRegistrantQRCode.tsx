import { trpc } from "@/app/_trpc/client";
import useWebApp from "@/hooks/useWebApp";
import { Preloader } from "konsta/react";
import { ScanLine } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React from "react";

type ScanRegistrantQRCodeProps = {
  children?: React.ReactNode;
};

const ScanRegistrantQRCode: React.FC<ScanRegistrantQRCodeProps> = ({ children }) => {
  const params = useParams<{ hash: string }>();
  const webApp = useWebApp();
  const router = useRouter();

  // TRPC
  const checkInTicket = trpc.ticket.checkInTicket.useMutation({
    onSuccess: (data) => {
      try {
        webApp?.HapticFeedback?.notificationOccurred?.("success");
      } catch (_) {}
      
      let message = "Successfully checked in!";
      if (data && "alreadyCheckedIn" in data && data.alreadyCheckedIn) {
        message = "Already checked in!";
        try {
          webApp?.HapticFeedback?.notificationOccurred?.("error");
        } catch (_) {}
      }

      webApp?.showPopup({
        title: (data && "alreadyCheckedIn" in data && data.alreadyCheckedIn) ? "Already Checked In ⚠️" : "Check-In Success ✅",
        message: message,
      }, () => {
        // Automatically reopen scanner
        if (!(data && "alreadyCheckedIn" in data && data.alreadyCheckedIn)) {
          handleOnClick();
        }
      });
    },
    onError: (error) => {
      try {
        webApp?.HapticFeedback?.notificationOccurred?.("error");
      } catch (_) {}
      webApp?.showPopup({
        title: "Check-In Failed ❌",
        message: error.message,
      }, () => {
        // Automatically reopen scanner
        handleOnClick();
      });
    },
  });

  const handleOnClick = () => {
    if (webApp && webApp.showScanQrPopup) {
      webApp.showScanQrPopup(
        {
          text: "Check-In Registrant",
        },
        (ticketUuid) => {
          checkInTicket.mutate({ event_uuid: params.hash, ticketUuid });
        }
      );
    } else {
      window.open(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?startapp=manage_${params.hash}`, "_blank");
    }
  };

  if (checkInTicket.isLoading) {
    return <Preloader />;
  }

  return children ? (
    <div
      onClick={() => {
        handleOnClick();
      }}
    >
      {children}
    </div>
  ) : (
    <>
      {!webApp || !webApp.showScanQrPopup ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}?startapp=manage_${params.hash}`, "_blank");
          }}
          className="text-primary bg-primary/10 rounded px-2 py-1 text-sm font-semibold"
        >
          Open in Telegram to scan
        </button>
      ) : (
        <ScanLine
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOnClick();
          }}
          className="text-primary bg-primary/10 rounded"
        />
      )}
    </>
  );
};

export default ScanRegistrantQRCode;
