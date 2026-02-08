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
  const checkInRegistrant = trpc.registrant.checkinRegistrantRequest.useMutation({
    onSuccess: (data) => {
      webApp?.showPopup({
        title: "Check-In Success ✅",
        message: data.message,
      });
    },
    onError: (error) => {
      webApp?.showPopup({
        title: "Check-In Failed ❌",
        message: error.message,
      });
    },
  });

  const handleOnClick = () => {
    if (children) {
      router.push(`/events/${params.hash}/manage/guest-list`);
    }

    webApp?.showScanQrPopup(
      {
        text: "Check-In Registrant",
      },
      (registrant_uuid) => {
        checkInRegistrant.mutate({ event_uuid: params.hash, registrant_uuid });
      }
    );
  };

  if (checkInRegistrant.isLoading) {
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
    <ScanLine
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleOnClick();
      }}
      className="text-primary bg-primary/10 rounded"
    />
  );
};

export default ScanRegistrantQRCode;
