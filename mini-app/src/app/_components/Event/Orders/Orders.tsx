import { useGetEventOrders } from "@/hooks/events.hooks";
import { InferArrayType } from "@/lib/utils";
import { ListItem } from "konsta/react";
import { useParams } from "next/navigation";
import { SiTon } from "react-icons/si";
import ListLayout from "../../atoms/cards/ListLayout";
import DataStatus from "../../molecules/alerts/DataStatus";

const EventOrders = () => {
  const params = useParams<{ hash: string }>();
  const { data: orders, isLoading, isError } = useGetEventOrders();
  type OrderType = InferArrayType<typeof orders>;

  const renderOrderDescription = (order: OrderType) => {
    switch (order.order_type) {
      case "event_creation":
        return order.state === "completed"
          ? "Payment of event creation was successful"
          : "Event creation order";
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
