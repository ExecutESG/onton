import { useMainButton } from "@tma.js/sdk-react";
import { useCallback, useEffect } from "react";

import { PaymentToken } from "~/types/order.types";

const BuyTicketSendTransactionButton = (props: {
  price: string | number;
  validateForm: () => boolean;
  paymentToken?: PaymentToken | null;
  text?: string;
  bgColor?: `#${string}`;
  textColor?: `#${string}`;
}) => {
  const mainButton = useMainButton(true);

  const buyTicketOnClick = useCallback(async () => {
    props.validateForm();
  }, [props.validateForm]);

  useEffect(() => {
    const buttonText =
      props.text || (props.paymentToken ? `Pay (${props.paymentToken.symbol})` : "Confirm");
    mainButton?.setBgColor(props.bgColor || "#007AFF");
    mainButton?.setTextColor(props.textColor || "#ffffff").setText(buttonText);
    mainButton?.enable().show();
    mainButton?.hideLoader();

    mainButton?.on("click", buyTicketOnClick);
    return () => {
      mainButton?.hide().disable();
      mainButton?.off("click", buyTicketOnClick);
    };
  }, [mainButton, buyTicketOnClick, props.text, props.paymentToken?.symbol, props.bgColor, props.textColor]);

  return <></>;
};

export default BuyTicketSendTransactionButton;
