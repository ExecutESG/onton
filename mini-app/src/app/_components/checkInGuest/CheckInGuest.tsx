"use client";

import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import useWebApp from "@/hooks/useWebApp";
import { FC, useCallback, useEffect, useState } from "react";
import { RiQrScan2Line } from "react-icons/ri";
import { CheckInState } from "./CheckInState";
import TicketDrawer from "./TicketDrawer"; // Import the TicketDrawer component

const CheckInGuest: FC<{
  params: {
    hash: string;
    setNeedRefresh: (_data: any) => void;
    needRefresh: boolean;
  };
}> = ({ params }) => {
  const WebApp = useWebApp();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ticketUuid, setTicketUuid] = useState<string | null>(null);
  const [drawerTitle] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [checkInState, setCheckInState] = useState<CheckInState>("NoTicketData");

  const ticketQuery = trpc.ticket.getTicketByUuid.useQuery(
    { ticketUuid: ticketUuid ?? "" },
    {
      enabled: !!ticketUuid,
      retry: false,
    }
  );

  const eventTicketQuery = trpc.eventTicket.getEventTicketById.useQuery(
    { ticketId: ticketData?.ticket_id ?? 0 }, // Assuming ticket_id is available
    {
      enabled: !!ticketData?.ticket_id,
      retry: false,
    }
  );

  useEffect(() => {
    if (ticketQuery.isSuccess && ticketQuery.data) {
      const data = ticketQuery.data;
      setTicketData(data);

      // Handle the new states for MINTING or VALID
      if (data.status === "USED") {
        setCheckInState("alreadyCheckedIn");
      } else if (data.status === "UNUSED") {
        setCheckInState("needToCheckin");
      } else if (data.status === "MINTING" || data.status === "VALID") {
        setCheckInState("ticketInProcess");
      }
      setDrawerOpen(true); // Ensure the drawer opens after successful data fetch
    } else if (ticketQuery.isError) {
      console.error(ticketQuery.error);
      if (ticketQuery.error?.data?.httpStatus === 404) {
        setCheckInState("NoTicketData");
      } else {
        setCheckInState("checkInError");
      }
      setDrawerOpen(true); // Ensure the drawer opens on error as well
    }
  }, [ticketQuery.isSuccess, ticketQuery.isError, ticketQuery.data]);

  // Close drawer and reset states when the drawer is closed
  useEffect(() => {
    if (!drawerOpen) {
      setTicketData(null);
      setTicketUuid(null);
      setCheckInState("NoTicketData");
    }
  }, [drawerOpen]);

  const checkInMutation = trpc.ticket.checkInTicket.useMutation();

  useEffect(() => {
    if (checkInMutation.isSuccess) {
      ticketQuery.refetch().then(() => {
        const result = checkInMutation.data;
        // @ts-ignore
        if (result && result.checkInSuccess) {
          setCheckInState("checkedInSuccess");
          // @ts-ignore
          console.log("Check-in successful, ID:", result.result.id);
          // @ts-ignore
          params.setNeedRefresh(result.result.id);
        } else if (result && "alreadyCheckedIn" in result) {
          setCheckInState("alreadyCheckedIn");
        }
      });
    } else if (checkInMutation.isError) {
      setCheckInState("checkInError");
    }
  }, [checkInMutation.isSuccess, checkInMutation.isError, checkInMutation.data]);

  const handleCheckIn = useCallback(() => {
    if (ticketData && ticketData.order_uuid) {
      setCheckInState("checkingInLoading");
      checkInMutation.mutate({ ticketUuid: ticketData.order_uuid });
    } else {
      setCheckInState("NoTicketData");
    }
  }, [ticketData, checkInMutation]);

  const handleScanQr = () => {
    if (!WebApp?.isVersionAtLeast("6.0")) {
      setCheckInState("checkInError");
      return;
    }

    WebApp?.showScanQrPopup?.({}, (qrText) => {
      try {
        // const uuidMatch = qrText.match(/order_uuid=([\w-]+)/);
        // if (uuidMatch && uuidMatch[1]) {
        //   setTicketUuid(uuidMatch[1]);
        // }
        setTicketUuid(qrText);
      } catch (error) {
        setCheckInState("checkInError");
      } finally {
        WebApp?.closeScanQrPopup?.();
        WebApp.BackButton.show();
      }
    });
  };

  return (
    <>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleScanQr();
        }}
        variant="link" // Use the link variant
        className="ml-auto flex items-center text-sm text-gray-300 px-0 no-underline hover:no-underline"
      >
        <RiQrScan2Line className="mr-2" /> Scan QR
      </Button>

      <TicketDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        drawerTitle={drawerTitle}
        checkInState={checkInState}
        ticketData={ticketData}
        eventTicketData={eventTicketQuery.data}
        handleCheckIn={handleCheckIn}
        handleScanQr={handleScanQr}
      />
    </>
  );
};

export default CheckInGuest;
