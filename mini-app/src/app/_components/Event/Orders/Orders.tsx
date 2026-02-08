import { useConfig } from "@/context/ConfigContext";
import { useGetEventOrders } from "@/hooks/events.hooks";
import { useUpdateOrder } from "@/hooks/orders.hooks";
import { InferArrayType } from "@/lib/utils";
import { beginCell, toNano } from "@ton/core";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Button, ListItem } from "konsta/react";
import { useParams } from "next/navigation";
import { SiTon } from "react-icons/si";
import { toast } from "sonner";
import ListLayout from "../../atoms/cards/ListLayout";
import DataStatus from "../../molecules/alerts/DataStatus";

const EventOrders = () => {
  const params = useParams<{ hash: string }>();
  const { data: orders, isLoading, isError } = useGetEventOrders();
  const updateOrder = useUpdateOrder({ event_uuid: params.hash });
  const config = useConfig();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  type OrderType = InferArrayType<typeof orders>;

  const handlePayment = async (order: OrderType) => {
    try {
      if (!wallet?.account.address) {
        tonConnectUI.openModal();
        return;
      }

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [
          {
            amount: toNano(order.total_price).toString(),
            address: config.ONTON_WALLET_ADDRESS!,
            payload: beginCell()
              .storeUint(0, 32)
              .storeStringTail(`onton_order=${order.uuid}`)
              .endCell()
              .toBoc()
              .toString("base64"),
          },
        ],
      });

      toast.info("Processing transaction...");
      updateOrder.mutate({
        state: "confirming",
        order_uuid: order.uuid,
      });
    } catch (error) {
      toast.error("Payment failed. Please try again.");
      console.error("Payment error:", error);
    }
  };

  const renderOrderDescription = (order: OrderType) => {
    switch (order.order_type) {
      case "event_creation":
        return order.state === "completed"
          ? "Payment of event creation was successful"
          : "Event won't be created unless this order is paid";
      case "event_capacity_increment":
        return `Increase event capacity by ${order.total_price / 0.06} tickets`;
      default:
        return "Order details";
    }
  };

  const OrdersSection = ({
    filterFn,
    label,
  }: {
    filterFn: (_o: OrderType) => boolean;
    label: { text: string; variant: "danger" | "primary" | "success" | "warning" };
  }) => {
    if (orders?.filter(filterFn).length === 0) {
      return null;
    }

    return (
      <ListLayout
        isLoading={isLoading}
        isEmpty={orders?.length === 0 || isError}
        title="Orders List"
        label={label}
      >
        {orders?.filter(filterFn).map((order) => (
          <ListItem
            key={order.uuid}
            title={
              <span className="flex gap-2 items-center">
                <b className="font-extrabold antialiased">{order.total_price}</b>
                <SiTon className="text-sky-600" />
              </span>
            }
            footer={
              <div className="flex flex-col mt-2 gap-2">
                <p className="capitalize">
                  <b className="font-semibold antialiased">{order.order_type.replaceAll("_", " ")}</b>:{" "}
                  {renderOrderDescription(order)}
                </p>
                {order.state === "new" && (
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePayment(order);
                    }}
                  >
                    {wallet?.account.address ? "Pay" : "Connect Wallet"}
                  </Button>
                )}
              </div>
            }
            after={<p className={`capitalize ${order.state === "completed" ? "text-green-600" : ""}`}>{order.state}</p>}
          />
        ))}
      </ListLayout>
    );
  };

  return (
    <div className="space-y-3 pb-6">
      <div className="flex justify-center">
        <TonConnectButton className="[&>button]:px-2 [&>button]:py-3" />
      </div>
      {orders?.length === 0 ? (
        <DataStatus
          status="not_found"
          description={"Orders list is empty"}
        />
      ) : (
        <>
          <OrdersSection
            filterFn={(o) => o.state === "new"}
            label={{ text: "New", variant: "danger" }}
          />

          <OrdersSection
            filterFn={(o) => ["confirming", "processing"].includes(o.state)}
            label={{ text: "In Progress", variant: "primary" }}
          />

          <OrdersSection
            filterFn={(o) => o.state === "completed"}
            label={{ text: "Completed", variant: "success" }}
          />

          <OrdersSection
            filterFn={(o) => ["failed", "cancelled"].includes(o.state)}
            label={{ text: "Failed", variant: "warning" }}
          />
        </>
      )}
    </div>
  );
};

export default EventOrders;
