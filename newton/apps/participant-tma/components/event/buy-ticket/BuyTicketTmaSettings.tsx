"use client";

import { useBackButton, useMainButton, useMiniApp } from "@tma.js/sdk-react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isRequestingTicketAtom } from "~/store/atoms/event.atoms";
import { PaymentToken } from "~/types/order.types";
import BuyTicketConnectWalletButton from "./BuyTicketConnectWalletButton";
import BuyTicketSendTransactionButton from "./BuyTicketSendTransactionButton";

type BuyTicketTmaSettingsProps = {
  eventId: string;
  price: string | number;
  paymentToken: PaymentToken | null;
  isSoldOut: boolean;
  userHasTicket: boolean;
  orderAlreadyPlace: boolean;
  validateForm: () => boolean;
};

const BuyTicketTmaSettings = (props: BuyTicketTmaSettingsProps) => {
  const mainButton = useMainButton(true);
  const backButton = useBackButton(true);
  const tma = useMiniApp(true);
  const [tonconnectUI] = useTonConnectUI();
  const isRequestingTicket = useAtomValue(isRequestingTicketAtom);

  // state
  const router = useRouter();

  // main button
  useEffect(() => {
    console.log("[BuyTicketTmaSettings] evaluate", {
      userHasTicket: props.userHasTicket,
      orderAlreadyPlace: props.orderAlreadyPlace,
      isSoldOut: props.isSoldOut,
      paymentToken: props.paymentToken,
      isRequesting: isRequestingTicket.state,
      orderState: isRequestingTicket.state ? "pending" : "idle",
    });

    if (props.userHasTicket) {
      if (!isRequestingTicket.state) {
        router.push(`/ticket/${props.eventId}`);
      }
      mainButton?.hideLoader();

      mainButton?.hide().disable();
      return () => {
        mainButton?.hide().disable();
      };
    }

    if (props.orderAlreadyPlace) {
      mainButton?.setBgColor("#007AFF");
      mainButton?.setTextColor("#ffffff").setText("Pending...");
      mainButton?.showLoader();
      mainButton?.disable().show();
      mainButton?.on("click", () => {});
      setTimeout(
        () => {
          // reload full application
          window.location.reload();
        },
        1000 * 60 * 5
      );
      return () => {
        mainButton?.hide().disable();
        mainButton?.hideLoader();
      };
    }

    if (props.isSoldOut) {
      mainButton?.setBgColor("#E9E8E8");
      mainButton?.setTextColor("#BABABA").setText(`SOLD OUT`);
      mainButton?.disable().show();
      mainButton?.hideLoader();

      return () => {
        mainButton?.hide().disable();
      };
    }

    mainButton?.hideLoader();
    mainButton?.hide().disable();

    return () => {
      mainButton?.hideLoader();
      mainButton?.hide().disable();
    };
  }, [mainButton, props.userHasTicket, props.orderAlreadyPlace, props.isSoldOut, props.eventId, isRequestingTicket.state, props.paymentToken]);

  // back button
  useEffect(() => {
    backButton?.on("click", () => {
      router.push(`/event/${props.eventId}`);
    });

    backButton?.show();

    return () => {
      backButton?.hide();
    };
  }, [backButton?.isVisible]);

  useEffect(() => {
    tma?.setBgColor("#EFEFF4");
    tma?.setHeaderColor("#EFEFF4");
  }, [tma?.bgColor]);

  return (
    <>
      {(() => {
        if (props.userHasTicket) {
          return null;
        }
        if (isRequestingTicket.state) {
          return null;
        }
        if (props.isSoldOut) {
          return null;
        }
        if (!tonconnectUI.account?.address) {
          console.log("[BuyTicketTmaSettings] wallet not connected");
          return <BuyTicketConnectWalletButton />;
        }
        if (!props.paymentToken) {
          console.log("[BuyTicketTmaSettings] missing payment token");
          return null;
        }
        console.log("[BuyTicketTmaSettings] rendering pay button", props.paymentToken.symbol);
        return (
          <BuyTicketSendTransactionButton
            validateForm={props.validateForm}
            price={props.price}
            paymentToken={props.paymentToken}
          />
        );
      })()}
    </>
  );
};

export default BuyTicketTmaSettings;
