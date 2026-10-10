import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { EventRow } from "@/db/schema/events";
import { deployNftCollection } from "@/cronJobs/helper/deployNftCollection";

/**
 * Handles the logic for NFT ticket types:
 * - NFT => Deploy new NFT collection if not already set
 */
export const handleTicketType = async (
  event: EventRow,
  paymentInfo?: EventPaymentSelectType
): Promise<{ collectionAddress: string | null; ticketActivityId: number | null }> => {
  if (!paymentInfo) {
    return { collectionAddress: null, ticketActivityId: null };
  }

  let updatedCollectionAddress = paymentInfo.collectionAddress || null;

  if (paymentInfo.ticket_type === "NFT") {
    // (A) NFT Ticket => Deploy NFT Collection if not already done
    if (!paymentInfo.collectionAddress) {
      updatedCollectionAddress = await deployNftCollection(event, paymentInfo);
    }
  }

  return { collectionAddress: updatedCollectionAddress, ticketActivityId: null };
};
