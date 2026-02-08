import { EventRow } from "@/db/schema/events";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { logger } from "@/server/utils/logger";
import { sendNftDeployedNotifications } from "@/cronJobs/helper/sendNftDeployedNotifications";
import { deployCollection } from "@/lib/nft";
import { config } from "@/server/config";

/**
 * Deploys an NFT collection if metadata is successfully uploaded.
 * Returns the new collection address or `null` on failure.
 */
export const deployNftCollection = async (event: EventRow, paymentInfo: EventPaymentSelectType): Promise<string | null> => {
  // Upload NFT metadata
  const metaDataUrl = await uploadJsonToMinio(
    {
      name: paymentInfo.title,
      description: paymentInfo.description,
      image: paymentInfo.ticketImage,
      cover_image: paymentInfo.ticketImage,
    },
    "ontoncollection"
  );
  if (!metaDataUrl) {
    // failed to upload => skip
    return null;
  }

  logger.log("MetaDataUrl_CreateEvent_CronJob : " + metaDataUrl);

  // Deploy the NFT collection
  logger.log(`paid_event_deploy_collection_${event.event_uuid}`);
  const deployedAddress = await deployCollection(metaDataUrl, {
    expectedMinterAddress: config?.ONTON_MINTER_WALLET ?? undefined,
  });
  if (!deployedAddress) {
    logger.error(`deployNftCollection: failed to deploy collection for event ${event.event_uuid}`);
    return null;
  }
  logger.log(`paid_event_deployed_collection_${event.event_uuid}_${deployedAddress}`);

  // Telegram notifications
  await sendNftDeployedNotifications(event, deployedAddress, paymentInfo);

  return deployedAddress;
};
