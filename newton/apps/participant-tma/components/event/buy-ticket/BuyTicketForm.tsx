"use client";

import { useMainButton } from "@tma.js/sdk-react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Card, CardContent } from "@ui/base/card";
import { Input } from "@ui/base/input";
import { Section } from "@ui/base/section";
import { toast } from "@ui/base/sonner";
import SeparatorTma from "@ui/components/Separator";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { FormEventHandler, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import BuyTicketTmaSettings from "~/components/event/buy-ticket/BuyTicketTmaSettings";
import { useTransferTon } from "~/hooks/ton.hooks";
import { useAddOrderMutation } from "~/hooks/useAddOrderMutation";
import { createStarsInvoice } from "~/services/orders.services";
import { discountCodeAtom, isRequestingTicketAtom, paymentRailAtom } from "~/store/atoms/event.atoms";
import { useUserStore } from "~/store/user.store";
import { PaymentToken } from "~/types/order.types";
import { ALLOWED_TONFEST_EVENT_UUIDS } from "~/utils/constants";
import BuyTicketTxQueryState from "./BuyTicketTxQueryState";

type BuyTicketFormProps = {
  id: string;
  price: string | number;
  isSoldOut: boolean;
  userHasTicket: boolean;
  orderAlreadyPlace: boolean;
  event_uuid: string;
  sendTo: string;
  affiliate_id: string | null;
  paymentToken: PaymentToken | null;
};

interface BuyTicketFormElement extends HTMLFormElement {
  full_name: HTMLInputElement;
  telegram: HTMLInputElement;
  company: HTMLInputElement;
  position: HTMLInputElement;
  owner_address: HTMLInputElement;
  event_id: HTMLInputElement;
  boc: HTMLInputElement;
  user_id: HTMLInputElement;
}

const BuyTicketForm = (params: BuyTicketFormProps) => {
  const user = useUserStore((s) => s.user);
  const form = useRef<BuyTicketFormElement>(null);
  const setIsRequestingTicket = useSetAtom(isRequestingTicketAtom);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const router = useRouter();
  const addOrder = useAddOrderMutation();
  const mainButton = useMainButton(true);
  const transfer = useTransferTon();

  const discountCode = useAtomValue(discountCodeAtom);
  const paymentRail = useAtomValue(paymentRailAtom);

  const affiliate_id = params.affiliate_id || null;

  const buyTicketOnClick: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!form.current) {
      throw new Error("form is not defined");
    }
    const formdata = new FormData(form.current);
    const data = Object.fromEntries(formdata) as {
      full_name: string;
      telegram: string;
      company?: string;
      position?: string;
      owner_address?: string;
    };

    mainButton?.hide().disable();
    mainButton?.hideLoader();

    const isFree = Number(params.price) === 0;

    try {
      const orderData = await addOrder.mutateAsync({
        event_uuid: params.event_uuid,
        affiliate_id,
        ...data,
        owner_address: wallet?.account.address || null,
        payment_method: isFree ? undefined : (paymentRail === "STARS" ? "STAR" : "TON"),
        coupon_code: discountCode || null,
      });

      // 1) Free RSVP or already completed ticket
      if (isFree || orderData.is_free || orderData.state === "completed" || Number(orderData.total_price) === 0) {
        toast.success("Ticket confirmed!");
        router.push(`/ticket/${params.event_uuid}`);
        return;
      }

      // 2) Telegram Stars payment flow
      if (paymentRail === "STARS") {
        try {
          const invoiceRes = await createStarsInvoice(orderData.order_id);
          // @ts-ignore
          if (typeof window !== "undefined" && window?.Telegram?.WebApp?.openInvoice) {
            // @ts-ignore
            window.Telegram.WebApp.openInvoice(invoiceRes.invoice_link, (status: string) => {
              if (status === "paid") {
                toast.success("Payment completed! Your ticket is confirmed.");
                router.push(`/ticket/${params.event_uuid}`);
              } else if (status === "failed") {
                toast.error("Payment failed. Please try again.");
                mainButton?.show().enable();
              } else {
                mainButton?.show().enable();
              }
            });
          } else {
            // Fallback for browser view
            window.open(invoiceRes.invoice_link, "_blank");
          }
        } catch (invoiceError: any) {
          toast.error(invoiceError.message || "Failed to create Stars invoice");
          mainButton?.show().enable();
        }
        return;
      }

      // 3) Crypto (TON / USDT) payment flow
      if (!wallet?.account.address) {
        toast.info("Please connect your TON wallet to pay with crypto");
        await tonConnectUI.openModal();
        mainButton?.show().enable();
        return;
      }

      if (!orderData.token) {
        throw new Error("Payment token information is missing in the order response");
      }

      console.log("transfer data", params.sendTo, Number(params.price), orderData.token.symbol, {
        comment: `onton_order=${orderData.order_id}`,
      });

      setIsRequestingTicket({ state: true, orderId: orderData.order_id });

      try {
        await transfer(params.sendTo, Number(orderData.total_price), orderData.token, {
          comment: `onton_order=${orderData.order_id}`,
        });
      } catch (error) {
        console.error("Error during transfer:", error);
        setIsRequestingTicket({ state: false });
        mainButton?.show().enable();
      }
    } catch (error) {
      setIsRequestingTicket({ state: false });
      mainButton?.show().enable();
      console.error("Error adding order:", error);
    }
  };

  const validateForm = useCallback(() => {
    const fields = ["full_name", "telegram"];
    let isValid = true;

    fields.forEach((field) => {
      if (!form.current?.[field].value) {
        toast.error(`Please fill in the information about yourself`, {
          icon: (
            <Image
              src={"/ptma/info-icon.svg"}
              alt={"info"}
              width={24}
              height={24}
            />
          ),
          id: "form-error-toast",
          duration: 5000,
        });
        isValid = false;
      }
    });

    if (isValid) {
      form.current?.requestSubmit();
    }

    return isValid;
  }, []);

  return (
    <Section
      variant={"plain"}
      className="grid gap-2"
    >
      <h4 className="text-telegram-6-10-section-header-text-color type-footnote font-normal">YOUR INFO</h4>
      <Card className="divide-y">
        <CardContent className={"py-0 pr-0"}>
          <form
            ref={form}
            onSubmit={buyTicketOnClick}
          >
            <CheckoutInput
              defaultValue={`${user?.first_name} ${user?.last_name}`}
              label="Name"
              name="full_name"
              placeholder="Full Name"
            />
            <SeparatorTma className={"m-0"} />
            <CheckoutInput
              defaultValue={`@${user?.username}`}
              label="Telegram"
              name="telegram"
              placeholder="@username"
            />
            {!ALLOWED_TONFEST_EVENT_UUIDS.includes(params.event_uuid) && (
              <>
                <SeparatorTma className={"m-0"} />
                <CheckoutInput
                  label="Company"
                  name="company"
                  placeholder="Company"
                />
                <SeparatorTma className={"m-0"} />
                <CheckoutInput
                  label="Position"
                  name="position"
                  placeholder="Designer"
                />
              </>
            )}
            {/* other data */}
            <input
              type="hidden"
              name="owner_address"
              value={wallet?.account.address}
            />
            <div className="mt-4 w-full pr-4">
              {Number(params.price) === 0 ? (
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#007AFF] py-3 text-white font-semibold shadow-md active:opacity-90"
                >
                  RSVP Now (Free)
                </button>
              ) : paymentRail === "STARS" ? (
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#FFB800] hover:bg-[#E5A700] py-3 text-black font-semibold shadow-md active:opacity-90 flex items-center justify-center gap-2"
                >
                  <span>Pay with Telegram Stars</span>
                  <span>⭐</span>
                </button>
              ) : wallet?.account.address ? (
                <button
                  type="submit"
                  className="w-full rounded-full bg-[#007AFF] py-3 text-white font-semibold shadow-md active:opacity-90"
                >
                  {params.paymentToken ? `Pay ${params.paymentToken.symbol}` : "Pay Crypto"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => tonConnectUI.openModal()}
                  className="w-full rounded-full bg-[#007AFF] py-3 text-white font-semibold shadow-md active:opacity-90"
                >
                  Connect Wallet to Pay
                </button>
              )}
            </div>
            <FormActionLoader />
          </form>
        </CardContent>
      </Card>
      <BuyTicketTmaSettings
        isSoldOut={params.isSoldOut}
        userHasTicket={params.userHasTicket}
        orderAlreadyPlace={params.orderAlreadyPlace}
        price={params.price}
        validateForm={validateForm}
        paymentToken={params.paymentToken}
        eventId={params.id}
      />
      {typeof window !== "undefined" && createPortal(<BuyTicketTxQueryState />, document.body)}
    </Section>
  );
};

function FormActionLoader() {
  const [requestState] = useAtom(isRequestingTicketAtom);

  const mainButton = useMainButton(true);

  useEffect(() => {
    mainButton?.hideLoader();

    if (requestState.state) {
      console.log("[FormActionLoader] hiding main button (requesting)");
      mainButton?.hide().disable();
    } else {
      console.log("[FormActionLoader] showing main button");
      mainButton?.show().enable();
    }
  }, [requestState.state, mainButton]);

  return <></>;
}

type CheckoutInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

function CheckoutInput({ label, name, placeholder, ...props }: CheckoutInputProps) {
  return (
    <div className="grid grid-cols-3 items-center p-2.5 px-4 pl-0">
      <div className="col-span-1">
        <label
          className={"type-body opacity-80"}
          htmlFor={name}
        >
          {label}
        </label>
      </div>
      <Input
        className="col-span-2 rounded-none"
        type="text"
        placeholder={placeholder}
        name={name}
        id={name}
        {...props}
      />
    </div>
  );
}

export default BuyTicketForm;
