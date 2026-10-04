import { trpc } from "@/app/_trpc/client";
import { InferArrayType } from "@/lib/utils";
import { ListItem } from "konsta/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import ListLayout from "../../atoms/cards/ListLayout";
import DataStatus from "../../molecules/alerts/DataStatus";

const EventOrders = () => {
  const params = useParams<{ hash: string }>();
  const { data: treasuryData, isLoading, isError } = trpc.orders.getEventTreasury.useQuery({ event_uuid: params.hash });
  const [showLegacy, setShowLegacy] = useState(false);

  if (isLoading) return <div>Loading...</div>;
  if (isError || !treasuryData) return <div>Error loading treasury data</div>;

  const { summary, platform_fee_percent, payout_status, orders } = treasuryData;

  const ticketOrders = orders.filter(o => o.order_type === 'ts_csbt_ticket' || o.order_type === 'nft_mint');
  const legacyOrders = orders.filter(o => o.order_type === 'event_creation' || o.order_type === 'event_capacity_increment');

  return (
    <div className="space-y-4 pb-6 px-4">
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-4">Treasury Summary</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-500">Payout Status: <span className="font-semibold text-gray-800 dark:text-gray-200">{payout_status}</span></p>
        </div>
        
        {summary.length === 0 ? (
           <p className="text-sm text-gray-500">No sales yet.</p>
        ) : (
          <div className="space-y-4">
            {summary.map((stat) => {
              const estimatedFee = (stat.gross_revenue * (platform_fee_percent / 100));
              const estimatedShare = stat.gross_revenue - estimatedFee;
              return (
                <div key={stat.currency} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{stat.currency}</span>
                    <span className="text-sm bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded-full">{stat.tickets_sold} tickets sold</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gross Revenue</span>
                      <span className="font-medium">{stat.gross_revenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Platform Fee (Estimated, {platform_fee_percent}%)</span>
                      <span className="text-red-500 font-medium">-{estimatedFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                      <span className="font-semibold">Organizer Share (Estimated)</span>
                      <span className="text-green-600 font-bold">{estimatedShare.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ListLayout
        isLoading={false}
        isEmpty={ticketOrders.length === 0}
        title="Completed Ticket Orders"
        label={{ text: "Completed", variant: "success" }}
      >
        {ticketOrders.map((order) => (
          <ListItem
            key={order.uuid}
            title={<b className="font-extrabold antialiased">{order.total_price} {order.token_symbol}</b>}
            footer={
              <div className="flex flex-col mt-2 gap-1 text-sm text-gray-500">
                <p>Buyer: {order.buyer_first_name || ""} {order.buyer_last_name || ""}</p>
                <p>Date: {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}</p>
                <p>Type: {order.order_type === 'nft_mint' ? 'NFT' : 'TICKET'}</p>
              </div>
            }
            after={<p className="text-green-600 capitalize">{order.state}</p>}
          />
        ))}
      </ListLayout>

      {legacyOrders.length > 0 && (
        <div className="mt-6">
          <button 
            onClick={() => setShowLegacy(!showLegacy)}
            className="w-full py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg font-medium"
          >
            {showLegacy ? "Hide Legacy Orders" : "Show Legacy Orders"}
          </button>
          
          {showLegacy && (
            <div className="mt-4">
              <ListLayout
                isLoading={false}
                isEmpty={false}
                title="Legacy Orders"
                label={{ text: "Legacy", variant: "primary" }}
              >
                {legacyOrders.map((order) => (
                  <ListItem
                    key={order.uuid}
                    title={<b className="font-extrabold antialiased">{order.total_price} {order.token_symbol}</b>}
                    footer={
                      <div className="flex flex-col mt-2 gap-1 text-sm text-gray-500">
                        <p className="capitalize">Type: {order.order_type.replaceAll("_", " ")}</p>
                        <p>Date: {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}</p>
                      </div>
                    }
                    after={<p className="text-green-600 capitalize">{order.state}</p>}
                  />
                ))}
              </ListLayout>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventOrders;
