import { sendLogNotification, sendToEventsTgChannel } from "@/lib/tgBot";
import { is_mainnet } from "@/services/tonCenter";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { EventRow } from "@/db/schema/events";
import eventTokensDB from "@/db/modules/eventTokens.db";

/** Sends Telegram notifications once an NFT collection is deployed. */
export const sendNftDeployedNotifications = async (
  event: EventRow,
  collectionAddress: string,
  paymentInfo: EventPaymentSelectType
) => {
  const prefix = is_mainnet ? "" : "testnet.";
  const token = await eventTokensDB.getTokenById(Number(paymentInfo.token_id));
  const paymentSymbol = token?.symbol?.toLowerCase() ?? "ton";
  await sendLogNotification({
    message: `Deployed collection for <b>${event.title}</b>\n\n🎈<a href='https://${prefix}getgems.io/collection/${collectionAddress}'>Collection</a>\n\n👤Capacity: ${event.capacity}`,
    topic: "event",
  });
  await sendToEventsTgChannel({
    image: event.image_url,
    title: event.title,
    subtitle: event.subtitle,
    s_date: event.start_date,
    e_date: event.end_date,
    timezone: event.timezone,
    event_uuid: event.event_uuid,
    participationType: event.participationType,
    ticketPrice: {
      amount: paymentInfo.price,
      paymentType: paymentSymbol,
    },
  });
};
