"use client";

import { Card, CardContent } from "@ui/base/card";
import { toast } from "@ui/base/sonner";
import { useAtom, useSetAtom } from "jotai";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { useApplyCoupon } from "~/hooks/queries/useApplyCoupon";
import { discountCodeAtom, paymentRailAtom } from "~/store/atoms/event.atoms";

interface DiscountCodeProps {
  initialPrice: number;
  currency?: string;
  eventName: string;
  eventImage: string;
  has_discount: boolean;
  eventId: number;
}

interface TicketAttributeProps {
  attributeKey: string;
  attributeValue: React.ReactNode;
}

function TicketAttribute({ attributeKey, attributeValue }: TicketAttributeProps) {
  return (
    <div className="flex justify-between">
      <label className="text-[#8E8E93] text-[14px]">{attributeKey}:</label>
      <div className="flex items-center justify-between">{attributeValue}</div>
    </div>
  );
}

export default function CheckoutCard({
  initialPrice = 50,
  currency = "TON",
  eventName = "New Year Fest 2025",
  eventImage = "/placeholder.svg?height=200&width=200",
  has_discount,
  eventId,
}: DiscountCodeProps) {
  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponType, setCouponType] = useState("");
  const [finalPrice, setFinalPrice] = useState(initialPrice);
  const setEventDiscountCode = useSetAtom(discountCodeAtom);
  const [paymentRail, setPaymentRail] = useAtom(paymentRailAtom);

  const { mutate: applyCoupon, isPending: isLoading } = useApplyCoupon();

  const handleApplyDiscount = () => {
    if (discountCode.trim() === "") return;
    // Use hardcoded event ID; replace with dynamic ID if needed.
    applyCoupon(
      { eventId, discountCode },
      {
        onSuccess: (data) => {
          const { definition } = data;
          if (definition.cpd_type === "percent") {
            const cleanValue = Number(definition.value);
            setDiscount(cleanValue);
          } else if (definition.cpd_type === "fixed") {
            const cleanValue = Number(definition.value);
            setDiscount(cleanValue);
          }
          setCouponType(definition.cpd_type);
          setFinalPrice(data.definition.discounted_price);

          // set atom
          setEventDiscountCode(discountCode);
        },
        onError: () => {
          setDiscount(0);
          setFinalPrice(initialPrice);
          toast.error("Invalid coupon code");
          setEventDiscountCode(undefined);
        },
      }
    );
  };

  useEffect(() => {
    setEventDiscountCode(undefined);
  }, []);

  return (
    <div className="max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold mb-4">Checkout</h1>
      <Card>
        <CardContent className="p-2 flex flex-col divide-y divide-[#C8C7CB]">
          <div className="flex justify-between gap-3">
            <Image
              width={100}
              height={100}
              className="rounded aspect-square w-[100px] h-[100px]"
              src={eventImage}
              alt="Event Image"
            />
            <div className="flex flex-col w-full gap-1 min-w-0">
              <h2 className="text-[17px] truncate flex-1 font-semibold">{eventName}</h2>
              <TicketAttribute
                attributeKey="Price"
                attributeValue={
                  <span className="font-semibold">
                    {initialPrice} {currency}
                  </span>
                }
              />
              {has_discount && (
                <>
                  <TicketAttribute
                    attributeKey="Discount"
                    attributeValue={
                      <span className="text-[14px] text-[#8E8E93] font-normal">
                        {couponType === "fixed" ? `${discount} ${currency}` : `%${discount}`}
                      </span>
                    }
                  />
                  <TicketAttribute
                    attributeKey="Final Price"
                    attributeValue={
                      <span className="text-[#007AFF] font-semibold">
                        {finalPrice} {currency}
                      </span>
                    }
                  />
                </>
              )}
            </div>
          </div>
          {has_discount && (
            <div className="pt-3 mt-3">
              <label
                htmlFor="discount_code"
                className="px-4 text-[#3C3C4399]"
              >
                Discount Code
              </label>
              <label
                htmlFor="discount_code"
                className="flex px-4 py-3 justify-between bg-[#EEEEF0] rounded-[10px]"
              >
                <input
                  placeholder="Enter Discount Code"
                  className="bg-transparent w-full border-none outline-none"
                  id="discount_code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                />
                {isLoading ? (
                  <FaSpinner
                    className="animate-spin text-[#007AFF]"
                    size={24}
                  />
                ) : (
                  <button
                    className="text-[#007AFF]"
                    onClick={handleApplyDiscount}
                  >
                    Apply
                  </button>
                )}
              </label>
            </div>
          )}
          {initialPrice > 0 && (
            <div className="pt-3 mt-3 flex flex-col gap-2">
              <span className="text-[13px] font-medium text-[#8E8E93]">PAYMENT METHOD</span>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#EEEEF0] p-1">
                <button
                  type="button"
                  onClick={() => setPaymentRail("STARS")}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    paymentRail === "STARS"
                      ? "bg-white text-[#007AFF] shadow-sm"
                      : "text-[#8E8E93] hover:text-black"
                  }`}
                >
                  ⭐ Stars (1-Tap)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentRail("CRYPTO")}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    paymentRail === "CRYPTO"
                      ? "bg-white text-[#007AFF] shadow-sm"
                      : "text-[#8E8E93] hover:text-black"
                  }`}
                >
                  💎 Crypto ({currency})
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
