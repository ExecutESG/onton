"use client";

import EventOrders from "@/app/_components/Event/Orders/Orders";
import { Block } from "konsta/react";

export default function OrdersPage() {
  return (
    <div>
      <Block>
        <h1 className="text-lg font-bold">Event Orders</h1>
      </Block>
      {/* We can use `eventData` if needed, or just show <EventOrders/> */}
      <EventOrders />
    </div>
  );
}
