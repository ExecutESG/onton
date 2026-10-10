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

interface TicketTierItem {
  id: number;
  tier_name: string;
  price: number;
  ticket_type: "NFT" | "TSCSBT" | "TICKET";
  description?: string;
}

interface PaymentDetailsProp {
  price: number;
  title: string | null;
  ticket_type: "NFT" | "TSCSBT" | "TICKET";
  token: {
    symbol: string;
    decimals: number;
    is_native: boolean;
  } | null;
}

interface CheckoutFormProps {
  eventUuid: string;
  eventHash: string;
  eventTitle?: string;
  eventSubtitle?: string | null;
  /** ONTON_WALLET_ADDRESS — destination for crypto payments. Passed from SSR. */
  paymentWalletAddress: string | null;
  paymentDetails?: PaymentDetailsProp | null;
  ticketTiers?: TicketTierItem[];
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
export default function CheckoutForm({
  eventUuid,
  eventHash,
  eventTitle,
  eventSubtitle,
  paymentWalletAddress,
  paymentDetails,
  ticketTiers = [],
}: CheckoutFormProps) {
  const webApp = useWebApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUserStore();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const affiliateId = searchParams.get("affiliate_id");

  // Tier selection
  const paramTierId = searchParams.get("tier_id") ? Number(searchParams.get("tier_id")) : null;
  const initialTier = ticketTiers.find((t) => t.id === paramTierId) || ticketTiers[0] || null;
  const [selectedTierId, setSelectedTierId] = useState<number | null>(initialTier?.id ?? null);

  const selectedTier = ticketTiers.find((t) => t.id === selectedTierId) || initialTier;

  // Pricing & currency resolution
  const effectivePrice = selectedTier ? selectedTier.price : (paymentDetails?.price ?? 0);
  const effectiveTicketType = selectedTier ? selectedTier.ticket_type : (paymentDetails?.ticket_type ?? "NFT");
  const tokenSymbol = paymentDetails?.token?.symbol || (effectiveTicketType === "TSCSBT" ? "STAR" : "TON");
  const isStars = tokenSymbol === "STAR" || effectiveTicketType === "TSCSBT";
  const isFree = effectivePrice === 0;

  const [fullName, setFullName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentRail, setPaymentRail] = useState<PaymentRail>(isStars ? "STARS" : "CRYPTO");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingState, setProcessingState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync payment rail if tier changes
  useEffect(() => {
    setPaymentRail(isStars ? "STARS" : "CRYPTO");
  }, [isStars]);

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
        const authHeader = webApp?.initData || (typeof window !== "undefined" ? sessionStorage.getItem("telegram:initParams") : "") || "";
        const pollHeaders: Record<string, string> = {};
        if (authHeader) {
          pollHeaders["Authorization"] = authHeader;
          pollHeaders["x-init-data"] = authHeader;
        }
        const res = await fetch(`/api/v1/order/${pendingOrderId}`, {
          headers: pollHeaders,
          credentials: "include",
        });
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
  }, [pendingOrderId, processingState, eventUuid, router, webApp?.initData]);

  // Sync Telegram session cookie on mount
  useEffect(() => {
    const rawInit = webApp?.initData || (typeof window !== "undefined" ? sessionStorage.getItem("telegram:initParams") : "");
    if (rawInit) {
      fetch("/api/v1/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: rawInit }),
        credentials: "include",
      }).catch(() => {});
    }
  }, [webApp?.initData]);

  const handleSubmit = useCallback(async () => {
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    setIsSubmitting(true);
    setProcessingState("processing");

    try {
      const authHeader = webApp?.initData || (typeof window !== "undefined" ? sessionStorage.getItem("telegram:initParams") : "") || "";
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeader) {
        requestHeaders["Authorization"] = authHeader;
        requestHeaders["x-init-data"] = authHeader;
      }

      // 1. Create order via REST API
      const orderRes = await fetch("/api/v1/order", {
        method: "POST",
        headers: requestHeaders,
        credentials: "include",
        body: JSON.stringify({
          event_uuid: eventUuid,
          tier_id: selectedTierId && selectedTierId > 0 ? selectedTierId : undefined,
          full_name: fullName.trim(),
          telegram: telegram.trim(),
          company: company.trim(),
          position: position.trim(),
          owner_address: wallet?.account.address || null,
          payment_method: isFree ? undefined : isStars ? "STAR" : tokenSymbol === "USDT" ? "USDT" : "TON",
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
          headers: requestHeaders,
          credentials: "include",
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
  }, [
    eventUuid,
    selectedTierId,
    fullName,
    telegram,
    company,
    position,
    couponCode,
    paymentRail,
    isFree,
    isStars,
    tokenSymbol,
    wallet,
    affiliateId,
    webApp,
    tonConnectUI,
    router,
    paymentWalletAddress,
  ]);

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

  const formattedPrice = isFree ? "Free" : isStars ? `⭐ ${effectivePrice}` : `${effectivePrice} ${tokenSymbol}`;
  const tierDisplayName = selectedTier?.tier_name || paymentDetails?.title || "Standard Ticket";

  const buttonText = isSubmitting
    ? "Processing..."
    : isFree
    ? "Get Free Ticket"
    : paymentRail === "STARS"
    ? `Pay ${effectivePrice} ⭐`
    : !wallet
    ? "Connect Wallet"
    : `Pay ${effectivePrice} ${tokenSymbol} 💎`;

  return (
    <div className="min-h-screen bg-[#EFEFF4] pb-24">
      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Order Summary Card */}
        <div className="overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Order Summary</span>
              <h2 className="mt-0.5 truncate text-base font-bold text-gray-900">{eventTitle || "Event Admission"}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{tierDisplayName}</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-600">
                {formattedPrice}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>Payment Method</span>
            <span className="font-medium text-gray-800">
              {isFree ? "Free RSVP" : isStars ? "⭐ Telegram Stars" : `💎 ${tokenSymbol} Crypto`}
            </span>
          </div>
        </div>

        {/* Ticket Tier Selector (shown if event has multiple tiers) */}
        {ticketTiers.length > 1 && (
          <div className="overflow-hidden rounded-xl bg-white p-3 shadow-sm">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">Select Ticket Tier</span>
            <div className="space-y-2">
              {ticketTiers.map((tier) => {
                const tierIsFree = Number(tier.price) === 0;
                const tierIsStars = tier.ticket_type === "TSCSBT" || tokenSymbol === "STAR";
                const tierPriceDisplay = tierIsFree
                  ? "Free"
                  : tierIsStars
                  ? `⭐ ${tier.price}`
                  : `${tier.price} ${tokenSymbol}`;
                const isSelected = (selectedTier?.id ?? null) === tier.id;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                        : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{tier.tier_name}</div>
                      {tier.description && (
                        <div className="mt-0.5 text-xs text-gray-500">{tier.description}</div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-blue-600">{tierPriceDisplay}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

      </div>

      {/* Checkout Button */}
      <MainButton
        text={buttonText}
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
