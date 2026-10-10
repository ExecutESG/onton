import eventDB from "@/db/modules/events.db";
import { config } from "@/server/config";
import CheckoutForm from "./_components/CheckoutForm";
import { db } from "@/db/db";
import { eventPayment } from "@/db/schema/eventPayment";
import eventTokensDB from "@/db/modules/eventTokens.db";
import eventTicketTiersDB from "@/db/modules/eventTicketTiers.db";
import { eq } from "drizzle-orm";

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

  // Fetch payment details and token
  const paymentDetails = (
    await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event.event_uuid)).execute()
  ).pop() ?? null;

  const paymentToken = paymentDetails?.token_id
    ? await eventTokensDB.getTokenById(paymentDetails.token_id)
    : null;

  const tiers = await eventTicketTiersDB.getTiersByEventUuid(event.event_uuid).catch(() => []);

  return (
    <CheckoutForm
      eventUuid={event.event_uuid}
      eventHash={params.hash}
      eventTitle={event.title}
      eventSubtitle={event.subtitle}
      paymentWalletAddress={walletAddress}
      paymentDetails={
        paymentDetails
          ? {
              price: Number(paymentDetails.price || 0),
              title: paymentDetails.title || null,
              ticket_type: paymentDetails.ticket_type,
              recipient_address: paymentDetails.recipient_address || null,
              token: paymentToken
                ? {
                    symbol: paymentToken.symbol,
                    decimals: paymentToken.decimals,
                    is_native: paymentToken.is_native,
                  }
                : null,
            }
          : null
      }
      ticketTiers={tiers.map((t) => ({
        id: t.id,
        tier_name: t.tier_name,
        price: Number(t.price || 0),
        ticket_type: t.ticket_type,
        description: t.description,
      }))}
    />
  );
}

export const dynamic = "force-dynamic";
