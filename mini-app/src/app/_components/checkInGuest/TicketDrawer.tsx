"use client";

import VariantBadge from "@/app/_components/checkInGuest/VariantBadge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { isValidImageUrl } from "@/lib/isValidImageUrl";
import Image from "next/image";
import { FC, useCallback } from "react";
import { CheckInState } from "./CheckInState";

interface TicketDrawerProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  drawerTitle: string | null;
  checkInState: CheckInState;
  ticketData: any;
  eventTicketData: any;
  handleCheckIn: () => void;
  handleScanQr: () => void;
}

const formatAddress = (address: string) => {
  return address ? `${address.slice(0, 4)}....${address.slice(-3)}` : "Not available";
};

const TicketDrawer: FC<TicketDrawerProps> = ({
  open,
  onOpenChange,
  drawerTitle,
  checkInState,
  ticketData,
  eventTicketData,
  handleCheckIn,
  handleScanQr,
}) => {
  const defaultImage = "/ton-logo.png";

  const renderTicketInfo = useCallback(() => {
    if (!ticketData || !eventTicketData) {
      return null;
    }

    return (
      <>
        <DrawerHeader>
          <DrawerDescription className="text-left">
            <div className="flex flex-col items-start">
              <div className="relative w-full h-auto overflow-hidden shadow-lg cursor-pointer pt-1 flex justify-center items-center">
                <Image
                  src={isValidImageUrl(eventTicketData.ticketImage) ? eventTicketData.ticketImage : defaultImage}
                  alt="Ticket Image"
                  width={300}
                  height={300}
                  className="object-cover"
                  loading="lazy"
                />
              </div>
              <p className="mt-4 text-xl font-semibold">Ticket #{ticketData.id}</p>
              <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                {eventTicketData.description ?? "No description available."}
              </p>
              <div className="flex flex-col space-y-1 text-sm text-gray-400 w-full">
                <div className="flex justify-between items-center ">
                  <span>Status:</span>

                  <VariantBadge status={ticketData.status} />
                </div>
                <div className="flex justify-between">
                  <span>Owner:</span>
                  <span>{ticketData.telegram}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contract Address:</span>
                  <span>{formatAddress(eventTicketData.collectionAddress)}</span>
                </div>
              </div>
            </div>
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          {checkInState === "alreadyCheckedIn" && (
            <Button
              disabled
              className="bg-[#8D8E93] text-white"
            >
              Already Checked In
            </Button>
          )}
          {checkInState === "checkingInLoading" && (
            <Button
              disabled
              className="bg-[#8D8E93] text-white"
            >
              Checking In...
            </Button>
          )}
          {checkInState === "checkedInSuccess" && (
            <Button
              disabled
              className="bg-[#0A84FF] text-white"
            >
              Checked In Successfully
            </Button>
          )}
          {checkInState === "needToCheckin" && (
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCheckIn();
              }}
              className="bg-[#0A84FF] text-white"
            >
              Check In
            </Button>
          )}
          {checkInState === "checkInError" && (
            <Button
              disabled
              className="bg-[#8D8E93] text-white"
            >
              Check In Error
            </Button>
          )}
          {checkInState === "ticketInProcess" && (
            <Button
              disabled
              className="bg-[#8D8E93] text-white"
            >
              In Process
            </Button>
          )}
          {checkInState === "NoTicketData" && (
            <Button
              disabled
              className="bg-[#8D8E93] text-white"
            >
              Loading Ticket Data...
            </Button>
          )}
        </DrawerFooter>
      </>
    );
  }, [drawerTitle, checkInState, handleCheckIn, ticketData, eventTicketData]);

  const renderScanError = (errorMessage: string) => (
    <>
      <DrawerHeader>
        <DrawerTitle className="text-left">{drawerTitle}</DrawerTitle>
        <DrawerDescription className="text-center text-lg">{errorMessage} !</DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleScanQr();
          }}
          className="bg-[#0A84FF] text-white"
        >
          Scan Again
        </Button>
      </DrawerFooter>
    </>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
    >
      <DrawerContent>
        {checkInState === "checkInError"
          ? renderScanError("Failed to check in the ticket. Please try again.")
          : checkInState === "NoTicketData"
            ? renderScanError("Ticket Not Exist")
            : renderTicketInfo()}
      </DrawerContent>
    </Drawer>
  );
};

export default TicketDrawer;
