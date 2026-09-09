"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBackButton, useClosingBehavior, useMainButton, useMiniApp, useUtils } from "@tma.js/sdk-react";
import { useTonConnectModal, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { toast } from "@ui/base/sonner";

import { useEventData } from "~/hooks/queries/useEventData";
import { RequestError } from "~/utils/custom-error";

type EventMainButtonProps = {
  eventId: string;
  requiresTicketToChekin: boolean;
  pageAffiliate: string | null;
};

const EventTmaSettings = ({ eventId, requiresTicketToChekin, pageAffiliate }: EventMainButtonProps) => {
  const mainButton = useMainButton(true);
  const backButton = useBackButton(true);
  const closeBehavior = useClosingBehavior(true);
  const tma = useMiniApp(true);
  const tmaUtils = useUtils(true);
  const router = useRouter();
  const wallet = useTonWallet();
  const tonConnectModal = useTonConnectModal();
  const [tonConnectUi] = useTonConnectUI();

  const { data: event, isLoading, isError, isSuccess, error } = useEventData(eventId);

  const needsInfoUpdate = event?.needToUpdateTicket;

  const isEnded = event?.end_date !== undefined && event.end_date < Date.now() / 1000;

  useEffect(() => {
    if (isError && error instanceof RequestError && error.name === "REQUEST_401_ERROR") {
      tonConnectUi.disconnect();
      toast.error(error.message);
    }
  }, [isError]);

  useEffect(() => {
    if (isLoading) return;

    const goToTicketPage = () => router.push(`/ticket/${eventId}`);
    const goToUpdateInfoPage = () => router.push(`/event/${eventId}/claim-ticket`);
    const mainBtnOnClick = () =>
      router.push(`/event/${eventId}/buy-ticket${pageAffiliate ? `?affiliate=${pageAffiliate}` : ""}`);
    const openTonConnectModal = () => tonConnectModal.open();

    const setupMainButton = (bgColor: `#${string}`, textColor: `#${string}`, text: string, onClick: () => void) => {
      mainButton?.setBgColor(bgColor).setTextColor(textColor).setText(text).enable().show().on("click", onClick);
    };

    if (!event) return;

    const { userHasTicket, orderAlreadyPlace, isSoldOut } = event;

    if (userHasTicket && needsInfoUpdate) {
      setupMainButton("#007AFF", "#ffffff", "Update Ticket Info", goToUpdateInfoPage);
      return () => {
        mainButton?.hide().off("click", goToUpdateInfoPage);
      };
    }

    if (userHasTicket) {
      setupMainButton("#e1efff", "#007aff", "My Ticket", goToTicketPage);
      return () => {
        mainButton?.hide().off("click", goToTicketPage);
      };
    }

    if (orderAlreadyPlace) {
      mainButton
        ?.setBgColor("#007AFF")
        .setTextColor("#ffffff")
        .setText("Pending...")
        .showLoader()
        .disable()
        .show()
        .on("click", () => {});

      setTimeout(() => window.location.reload(), 1000 * 60 * 5);

      return () => {
        mainButton?.hide().off("click", () => {});
      };
    }

    if (!requiresTicketToChekin) {
      mainButton?.hide();
      return () => {
        mainButton?.hide();
      };
    }

    if (isEnded) {
      setupMainButton("#E9E8E8", "#BABABA", "Event Ended", () => {});
      return () => {
        mainButton?.hide();
      };
    }

    if (isSoldOut) {
      setupMainButton("#E9E8E8", "#BABABA", "SOLD OUT", () => {});
      return () => {
        mainButton?.hide();
      };
    }

    // Buy / RSVP Ticket if none of above conditions were true
    const isFree = !event.eventTicket || Number(event.eventTicket.price) === 0;
    const buttonText = isFree
      ? "RSVP (Free)"
      : `Get Ticket (${event.eventTicket.price} ${event.eventTicket.token?.symbol || "TON"})`;

    setupMainButton("#007AFF", "#ffffff", buttonText, mainBtnOnClick);
    router.prefetch(`/event/${eventId}/buy-ticket`);

    return () => {
      mainButton?.hide().off("click", mainBtnOnClick);
    };
  }, [
    mainButton,
    event,
    needsInfoUpdate,
    requiresTicketToChekin,
    router,
    tmaUtils,
    isLoading,
    isError,
    wallet?.account.address,
    isSuccess,
  ]);

  useEffect(() => {
    backButton?.hide();
    closeBehavior?.enableConfirmation();
    return () => {
      closeBehavior?.disableConfirmation();
    };
  }, [backButton, closeBehavior]);

  useEffect(() => {
    tma?.setBgColor("#ffffff");
    tma?.setHeaderColor("#ffffff");
  }, [tma]);

  return <></>;
};

export default EventTmaSettings;
