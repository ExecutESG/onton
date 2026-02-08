"use client";

import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { EventTriggerType } from "@/db/enum";
import useWebApp from "@/hooks/useWebApp";
import { cn } from "@/lib/utils";
import { Dialog } from "konsta/react"; // Import Konsta UI Dialog
import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { SiGoogleclassroom } from "react-icons/si";

const ButtonPOA = ({
  event_uuid,
  poa_type,
  showPOAButton,
}: {
  event_uuid: string;
  poa_type?: EventTriggerType;
  showPOAButton: boolean;
}) => {
  const WebApp = useWebApp();
  const initData = WebApp?.initData || "";
  const POAType = poa_type || "simple";
  const hapticFeedback = WebApp?.HapticFeedback;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);

  const { data: poaInfo, refetch } = trpc.EventPOA.Info.useQuery(
    { event_uuid },
    {
      enabled: !!initData,
      onSuccess(data) {
        if (!data.success) {
          // If info query returns success: false, show the error dialog
          setErrorMessage(data?.message || "Unknown error");
          setDialogOpen(true);
        }
      },
      onError(error) {
        // If there is a query-level error (network or unhandled), show it
        setErrorMessage(error.message);
        setDialogOpen(true);
      },
    }
  );

  const CreatePOAMutation = trpc.EventPOA.Create.useMutation({
    onError(error) {
      // Network or unknown error
      setErrorMessage(error.message);
      setDialogOpen(true);
    },
  });

  useEffect(() => {
    if (poaInfo && poaInfo.timeUntilNextPOA > 0) {
      setCountdown(poaInfo.timeUntilNextPOA);
    } else {
      setCountdown(0);
    }
  }, [poaInfo]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev - 1 <= 0) {
          clearInterval(timer);
          refetch(); // refetch to update remainingPOA/time
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, refetch]);

  const handleClick = async () => {
    if (!initData) return;
    const result = await CreatePOAMutation.mutateAsync({
      event_uuid,
      poa_type: POAType,
    });

    if (!result.success) {
      // Show error dialog with the returned message
      setErrorMessage(result.message || "An error occurred");
      setDialogOpen(true);
    } else {
      // POA created successfully, refetch info
      await refetch();
    }

    hapticFeedback?.impactOccurred("medium");
  };

  const isCreating = CreatePOAMutation.isLoading;
  const remainingPOA = poaInfo?.remainingPOA ?? 0;

  // Calculate minutes and seconds for the countdown
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  // Determine button state and text
  let buttonText = "Get Attendance";
  let disabled = !initData || isCreating;
  if (!showPOAButton) {
    buttonText = "Get Attendance (During Event)";
    disabled = true;
  } else if (remainingPOA === 0 && poaInfo?.success) {
    buttonText = "No POA remaining";
    disabled = true;
  } else if (countdown > 0) {
    buttonText = `Take attendance after ${minutes}m ${seconds}s`;
    disabled = true;
  } else if (remainingPOA > 0) {
    buttonText = `Get Attendance (${remainingPOA} left)`;
    disabled = disabled || false;
  }

  return (
    <>
      {/* Error Dialog */}
      <Dialog
        opened={dialogOpen}
        onBackdropClick={() => setDialogOpen(false)}
        title="Error"
      >
        {errorMessage && (
          <div style={{ padding: "1rem" }}>
            <p>{errorMessage}</p>
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDialogOpen(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Button
        className={cn("w-full text-sm xs:text-md space-x-2 mb-4 mt-2")}
        variant={"secondary"}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClick();
        }}
      >
        <SiGoogleclassroom />
        <span>{buttonText}</span>
        {isCreating && <LoaderIcon className="h-5 animate-spin" />}
      </Button>
    </>
  );
};

export default ButtonPOA;
