import eventDB from "@/db/modules/events.db";
import { config } from "@/server/config";
import CheckoutForm from "./_components/CheckoutForm";

type Props = { params: { hash: string } };

export default async function CheckoutPage({ params }: Props) {
  const event = await eventDB.selectEventByUuid(params.hash);

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#EFEFF4] px-4 text-center">
        <p className="text-lg font-semibold text-gray-800">Event Not Found</p>
      </div>
    );
  }

  const walletAddress = config?.ONTON_WALLET_ADDRESS ?? null;

  return (
    <CheckoutForm
      eventUuid={event.event_uuid}
      eventHash={params.hash}
      paymentWalletAddress={walletAddress}
    />
  );
}

export const dynamic = "force-dynamic";
