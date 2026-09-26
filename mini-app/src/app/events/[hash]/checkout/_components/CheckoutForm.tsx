"use client";

import { Input } from "@/components/ui/input";
import useWebApp from "@/hooks/useWebApp";
import { useUserStore } from "@/context/store/user.store";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";

type PaymentRail = "STARS" | "CRYPTO";

interface OrderResponse {
  order_id: string;
  state?: string;
  is_free?: boolean;
  total_price?: number;
  token?: {
    symbol: string;
    decimals: number;
    is_native: boolean;
    master_address: string | null;
  };
}

interface CheckoutFormProps {
  eventUuid: string;
  eventHash: string;
  /** ONTON_WALLET_ADDRESS — destination for crypto payments. Passed from SSR. */
  paymentWalletAddress: string | null;
}

/**
 * Converts a human-readable token amount to its smallest unit (e.g. TON → nanoTON).
 * Matches participant-tma's `toTokenUnits`.
 */
const toTokenUnits = (amount: number, decimals: number): bigint => {
  const factor = 10 ** Math.max(decimals, 0);
  return BigInt(Math.round(amount * factor));
};

/**
 * Multi-rail checkout form ported from participant-tma.
 * Supports: Free RSVP, Telegram Stars, TON/USDT crypto.
 */
export default function CheckoutForm({ eventUuid, eventHash, paymentWalletAddress }: CheckoutFormProps) {
  const webApp = useWebApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUserStore();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const affiliateId = searchParams.get("affiliate_id");

  const [fullName, setFullName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentRail, setPaymentRail] = useState<PaymentRail>("STARS");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingState, setProcessingState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-fill from Telegram user data
  useEffect(() => {
    if (webApp?.initDataUnsafe?.user) {
      const tgUser = webApp.initDataUnsafe.user;
      setFullName(`${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim());
      setTelegram(tgUser.username ? `@${tgUser.username}` : "");
    }
  }, [webApp]);

  // TMA back button
  useEffect(() => {
    if (!webApp) return;
    const handleBack = () => router.push(`/events/${eventHash}`);
    webApp.BackButton.show();
    webApp.BackButton.onClick(handleBack);
    return () => {
      webApp.BackButton.hide();
      webApp.BackButton.offClick(handleBack);
    };
  }, [webApp, eventHash, router]);

  // Poll order status after crypto tx is sent
  useEffect(() => {
    if (!pendingOrderId || processingState !== "processing") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/order/${pendingOrderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.state === "completed") {
          clearInterval(pollRef.current!);
          setPendingOrderId(null);
          toast.success("Payment confirmed!");
          setProcessingState("success");
          setTimeout(() => router.push(`/tickets/${eventUuid}`), 1500);
        } else if (data.state === "failed" || data.state === "cancelled") {
          clearInterval(pollRef.current!);
          setPendingOrderId(null);
          toast.error("Payment failed");
          setProcessingState("error");
          setIsSubmitting(false);
        }
      } catch {
        // Ignore transient fetch errors during polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingOrderId, processingState, eventUuid, router]);

  const handleSubmit = useCallback(async () => {
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    setIsSubmitting(true);
    setProcessingState("processing");

    try {
      // 1. Create order via REST API
      const orderRes = await fetch("/api/v1/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_uuid: eventUuid,
          full_name: fullName.trim(),
          telegram: telegram.trim(),
          company: company.trim(),
          position: position.trim(),
          owner_address: wallet?.account.address || null,
          payment_method: paymentRail === "STARS" ? "STAR" : "TON",
          coupon_code: couponCode || null,
          affiliate_id: affiliateId,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to create order");
      }

      const order: OrderResponse = await orderRes.json();

      // 2. Free ticket — done
      if (order.is_free || order.state === "completed" || Number(order.total_price) === 0) {
        toast.success("Ticket confirmed!");
        setProcessingState("success");
        setTimeout(() => router.push(`/tickets/${eventUuid}`), 1500);
        return;
      }

      // 3. Stars payment flow
      if (paymentRail === "STARS") {
        const invoiceRes = await fetch("/api/v1/order/stars-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.order_id }),
        });
        const invoiceData = await invoiceRes.json();

        if (!invoiceData.invoice_link) {
          throw new Error("Failed to create Stars invoice");
        }

        if (webApp?.openInvoice) {
          webApp.openInvoice(invoiceData.invoice_link, (status: string) => {
            if (status === "paid") {
              toast.success("Payment successful!");
              setProcessingState("success");
              setTimeout(() => router.push(`/tickets/${eventUuid}`), 1500);
            } else if (status === "failed") {
              toast.error("Payment failed");
              setProcessingState("error");
              setIsSubmitting(false);
            } else {
              // User closed the invoice dialog (cancelled)
              setProcessingState("idle");
              setIsSubmitting(false);
            }
          });
        } else {
          window.open(invoiceData.invoice_link, "_blank");
          setProcessingState("idle");
          setIsSubmitting(false);
        }
        return;
      }

      // 4. Crypto payment flow (TON / USDT)
      if (!wallet?.account.address) {
        toast.info("Connect your wallet to pay with crypto");
        await tonConnectUI.openModal();
        setProcessingState("idle");
        setIsSubmitting(false);
        return;
      }

      if (!order.token) {
        throw new Error("Payment token information is missing");
      }

      if (!paymentWalletAddress) {
        throw new Error("Payment wallet not configured");
      }

      const { Address, beginCell } = await import("@ton/core");
      const destinationAddress = Address.parse(paymentWalletAddress);
      const tokenAmount = toTokenUnits(Number(order.total_price), order.token.decimals ?? 9);

      if (!order.token.is_native && order.token.master_address) {
        // Jetton (USDT) transfer via assets-sdk
        const { assetsSdk } = await import("@/app/(navigation)/my/useTransfer");
        const sdk = await assetsSdk(tonConnectUI);
        if (!sdk.sender?.address) throw new Error("Wallet not connected");

        const forwardPayload = beginCell()
          .storeUint(0, 32)
          .storeStringTail(`onton_order=${order.order_id}`)
          .endCell();

        const jetton = sdk.openJetton(Address.parse(order.token.master_address));
        const myJettonWallet = await jetton.getWallet(sdk.sender.address);
        await myJettonWallet.send(sdk.sender, destinationAddress, tokenAmount, {
          notify: { payload: forwardPayload },
        });
      } else {
        // Native TON transfer
        const body = beginCell()
          .storeUint(0, 32)
          .storeStringTail(`onton_order=${order.order_id}`)
          .endCell()
          .toBoc();

        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 360,
          messages: [
            {
              address: destinationAddress.toString(),
              amount: tokenAmount.toString(),
              payload: body.toString("base64"),
            },
          ],
        });
      }

      // Transaction submitted — start polling for confirmation
      toast.success("Transaction sent! Waiting for confirmation...");
      setPendingOrderId(order.order_id);
      setProcessingState("processing");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      if (!message.includes("Cancelled") && !message.includes("Rejected")) {
        toast.error(message);
        setProcessingState("error");
      } else {
        toast.info("Transaction cancelled");
        setProcessingState("idle");
      }
      setIsSubmitting(false);
    }
  }, [eventUuid, fullName, telegram, company, position, couponCode, paymentRail, wallet, affiliateId, webApp, tonConnectUI, router, paymentWalletAddress]);

  // Processing overlay
  if (processingState === "processing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-7 text-center">
        <Loader2 className="mb-6 h-16 w-16 animate-spin text-blue-500" />
        <h2 className="mb-2 text-xl font-semibold">Processing your ticket...</h2>
        <p className="text-sm text-gray-500">
          Please wait while we confirm your payment and generate your ticket pass.
        </p>
      </div>
    );
  }

  if (processingState === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-7 text-center">
        <div className="mb-6 text-6xl">🎉</div>
        <h2 className="mb-2 text-xl font-semibold">Ticket confirmed!</h2>
        <p className="text-sm text-gray-500">Redirecting to your ticket pass...</p>
      </div>
    );
  }

  if (processingState === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-7 text-center">
        <div className="mb-6 text-6xl">❌</div>
        <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
        <p className="mb-4 text-sm text-gray-500">Your payment could not be processed.</p>
        <button
          onClick={() => {
            setProcessingState("idle");
            setIsSubmitting(false);
          }}
          className="rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEFF4] pb-24">
      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Registration Fields */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="divide-y p-0">
            <CheckoutInput label="Name" name="full_name" value={fullName} onChange={setFullName} placeholder="Full Name" />
            <CheckoutInput label="Telegram" name="telegram" value={telegram} onChange={setTelegram} placeholder="@username" />
            <CheckoutInput label="Company" name="company" value={company} onChange={setCompany} placeholder="Company" />
            <CheckoutInput label="Position" name="position" value={position} onChange={setPosition} placeholder="Role" />
          </div>
        </div>

        {/* Coupon Code */}
        <div className="overflow-hidden rounded-xl bg-white p-3 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-gray-500">Discount Code</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <button
                onClick={() => toast.info("Coupon will be validated on checkout")}
                className="shrink-0 rounded-lg px-3 text-sm font-medium text-blue-600"
              >
                Apply
              </button>
            </div>
        </div>

        {/* Payment Rail Selector */}
        <div className="overflow-hidden rounded-xl bg-white p-3 shadow-sm">
            <span className="mb-2 block text-xs font-medium text-gray-500">PAYMENT METHOD</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setPaymentRail("STARS")}
                className={`rounded-lg py-2 px-3 text-sm font-semibold transition-all ${
                  paymentRail === "STARS"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                ⭐ Stars
              </button>
              <button
                type="button"
                onClick={() => setPaymentRail("CRYPTO")}
                className={`rounded-lg py-2 px-3 text-sm font-semibold transition-all ${
                  paymentRail === "CRYPTO"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                💎 Crypto
              </button>
            </div>
        </div>
      </div>

      {/* Checkout Button */}
      <MainButton
        text={paymentRail === "STARS" ? "Pay with Stars ⭐" : wallet ? "Pay with Crypto 💎" : "Connect Wallet"}
        onClick={handleSubmit}
        disabled={isSubmitting}
        progress={isSubmitting}
        color="primary"
      />
    </div>
  );
}

/** Inline checkout form field matching Telegram's iOS-style list inputs */
function CheckoutInput({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) {
  return (
    <div className="grid grid-cols-3 items-center px-4 py-2.5">
      <label htmlFor={name} className="col-span-1 text-sm text-gray-500">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        className="col-span-2 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
