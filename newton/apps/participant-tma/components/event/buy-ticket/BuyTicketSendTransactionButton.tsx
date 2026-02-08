import { useMainButton } from "@tma.js/sdk-react";
import { useCallback, useEffect } from "react";

import { PaymentToken } from "~/types/order.types";

const BuyTicketSendTransactionButton = (props: {
  price: string | number;
  validateForm: () => boolean;
  paymentToken: PaymentToken;
}) => {
  const mainButton = useMainButton(true);

  const buyTicketOnClick = useCallback(async () => {
    const isFormValid = props.validateForm();

    if (!isFormValid) {
      return;
    }
  }, [props.validateForm]);

  useEffect(() => {
    console.log("[BuyTicketSendTransactionButton] init", props.paymentToken.symbol);
    mainButton?.setBgColor("#007AFF");
    mainButton?.setTextColor("#ffffff").setText(`Pay (${props.paymentToken.symbol})`);
    mainButton?.enable().show();
    mainButton?.hideLoader();

    mainButton?.on("click", buyTicketOnClick);
    return () => {
      mainButton?.hide().disable();
      mainButton?.off("click", buyTicketOnClick);
    };
    return () => {
      console.log("[BuyTicketSendTransactionButton] cleanup");
    };
  }, [mainButton, buyTicketOnClick, props.paymentToken.symbol]);

  return <></>;
};

export default BuyTicketSendTransactionButton;
