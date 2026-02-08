import useTransferPayment from "@/app/(navigation)/sample/useTransferPayment";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { TokenCampaignOrders, TokenCampaignSpinPackages } from "@/db/schema";
import { useTonAddress } from "@tonconnect/ui-react";
import Image from "next/image";
import { useState } from "react";
import RaffleImage from "../../_assets/images/raffle.svg";
import { SPIN_PRICE_IN_TON } from "../../GenesisOnions.constants";
import { useOrder } from "../../hooks/useOrder";
import { useWallet } from "../../hooks/useWallet";
import { ListItem } from "./ListItem";

interface Props {
  pkg: TokenCampaignSpinPackages;
  onOrderPaid: (order: TokenCampaignOrders) => void;
  onPaymentFailed: (err: Error) => void;
  allowBuy: boolean;
}

export const PackageItem = ({ pkg, onOrderPaid, onPaymentFailed, allowBuy }: Props) => {
  const [isPaying, setIsPaying] = useState(false);
  const transfer = useTransferPayment();

  const originalPrice = pkg.spinCount * SPIN_PRICE_IN_TON;
  const effectivePrice = Number(pkg.price);
  const discountAmount = originalPrice - effectivePrice;
  const discountPercent = Math.round((discountAmount / originalPrice) * 100);

  const hasWallet = !!useTonAddress();
  const { walletModal } = useWallet();
  const { updateStatusMutation, submitOrder } = useOrder();

  const handlePay = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsPaying(true);

    if (!hasWallet) {
      walletModal.open();
      setIsPaying(false);
      return;
    } else {
      // create an order
      const order = await submitOrder(pkg.id);

      if (!order) throw new Error("Order not created");

      try {
        const walletAddress = order?.wallet_address;
        const orderId = order.id;

        if (!walletAddress) {
          throw new Error("Wallet address not found");
        }

        try {
          await updateStatusMutation.mutateAsync({ orderId, status: "confirming" });

          await transfer(walletAddress, parseFloat(order.finalPrice), "TON", { comment: `OnionCampaign=${order.uuid}` });

          onOrderPaid(order);
        } catch (error) {
          console.error("Payment error:", error);
          await updateStatusMutation.mutateAsync({ orderId, status: "cancelled" });

          throw new Error("Transaction canceled or failed!");
        }
      } catch (error) {
        onPaymentFailed(error instanceof Error ? error : new Error("Unsuccesful payment!"));
      } finally {
        setIsPaying(false);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 col-span-1">
        <div className="flex flex-col gap-4 bg-white/15 p-2 rounded-2lg border">
          <div className="flex gap-2">
            <div>
              <Image
                src={pkg.imageUrl ?? RaffleImage}
                alt={pkg.name}
                width={36}
                height={36}
              />
            </div>

            <div className="flex flex-col gap-1 overflow-hidden">
              <Typography
                variant="subheadline2"
                weight="medium"
                className="text-nowrap text-ellipsis overflow-hidden"
              >
                {pkg.description}
              </Typography>

              <h3>
                <Typography
                  variant="caption2"
                  weight="light"
                  className="text-nowrap text-ellipsis overflow-hidden"
                >
                  {pkg.name}
                </Typography>
              </h3>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <Typography
                variant="footnote"
                weight="semibold"
                className="flex gap-1 items-end text-nowrap"
              >
                {effectivePrice} {pkg.currency}
              </Typography>
              {effectivePrice < originalPrice && (
                <Typography
                  className="line-through flex gap-1 items-end text-nowrap"
                  variant="caption2"
                  weight="normal"
                >
                  {originalPrice} {pkg.currency}
                </Typography>
              )}
            </div>

            <Button
              variant="default"
              className="bg-orange hover:bg-orange/80 drop-shadow-lg"
              onClick={handlePay}
              disabled={isPaying || !allowBuy}
              isLoading={isPaying}
            >
              <Typography
                variant="callout"
                weight="semibold"
              >
                Pay & Spin
              </Typography>
            </Button>
          </div>
        </div>

        <ul className="list-image-none flex flex-col gap-1">
          {discountAmount === 0 && (
            <ListItem>
              <Typography
                variant="caption1"
                weight="light"
              >
                Spin to win
              </Typography>
            </ListItem>
          )}
          {discountAmount > 0 && (
            <>
              <ListItem>
                <Typography
                  variant="caption1"
                  weight="light"
                  className="flex gap-1"
                >
                  <span>Save</span>
                  <Typography
                    variant="caption1"
                    weight="medium"
                  >
                    {discountAmount}
                  </Typography>
                  <span>{pkg.currency}</span>
                </Typography>
              </ListItem>

              <ListItem>
                <Typography
                  variant="caption1"
                  weight="light"
                >
                  {discountPercent <= 20 ? "Spin faster!" : "Hunting mode"}
                </Typography>
              </ListItem>
            </>
          )}
        </ul>
      </div>
    </>
  );
};
