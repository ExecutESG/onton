import { db } from "@/db/db";
import { tokenCampaignNftCollections } from "@/db/schema/tokenCampaignNftCollections";
import { eq, isNull } from "drizzle-orm";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { deployCollection } from "@/lib/nft"; // the function that returns string | null
import { logger } from "@/server/utils/logger";

// 1) The interface & validator from above
interface CollectionMetaData {
  name: string;
  description: string;
  image: string;
  cover_image?: string;
  social_links?: string[];
}

function validateCollectionMetaData(data: any, collId: number): asserts data is CollectionMetaData {
  if (typeof data !== "object" || data === null) {
    throw new Error(`[collId=${collId}] "collectionMetaData" is not an object`);
  }
  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error(`[collId=${collId}] Missing or invalid "name" in collectionMetaData`);
  }
  if (typeof data.description !== "string") {
    throw new Error(`[collId=${collId}] Missing or invalid "description" in collectionMetaData`);
  }
  if (typeof data.image !== "string") {
    throw new Error(`[collId=${collId}] Missing or invalid "image" in collectionMetaData`);
  }
  if (data.cover_image && typeof data.cover_image !== "string") {
    throw new Error(`[collId=${collId}] "cover_image" must be a string if present`);
  }
  if (data.social_links && !Array.isArray(data.social_links)) {
    throw new Error(`[collId=${collId}] "social_links" must be an array if present`);
  }
}

/**
 * Checks all rows in `token_campaign_nft_collections` where `address` is null.
 * For each row, uses its `collectionMetaData` to upload to Minio, deploy an on-chain collection,
 * then updates the row with the new address + metadataUrl.
 */
export async function deployMissingCampaignCollections() {
  // 1) Fetch collections with no on-chain address
  const collectionsToDeploy = await db
    .select()
    .from(tokenCampaignNftCollections)
    .where(isNull(tokenCampaignNftCollections.address))
    .execute();

  if (collectionsToDeploy.length === 0) {
    logger.log("No campaign collections need deployment.");
    return;
  }

  // 2) Iterate & deploy each
  for (const coll of collectionsToDeploy) {
    try {
      logger.log(`Deploying NFT collection for ID=${coll.id}, name=${coll.name}...`);

      // 2a) If your DB entry has `collectionMetaData`
      const metaDataObj = coll.collectionMetaData;
      if (!metaDataObj) {
        throw new Error(`[collId=${coll.id}] "collectionMetaData" is null or missing`);
      }

      // 2b) Validate structure
      validateCollectionMetaData(metaDataObj, coll.id);

      // 2c) Upload metadata to Minio
      //    If valid, it satisfies the interface => we can pass it directly
      const metaDataUrl = await uploadJsonToMinio(metaDataObj, "ontoncollection");
      logger.log(`MetaDataUrl for collection ID=${coll.id}: ${metaDataUrl}`);

      if (!metaDataUrl) {
        throw new Error(`[collId=${coll.id}] Failed uploading collectionMetaData to Minio`);
      }

      // 2d) Deploy the collection
      const deployedAddress = await deployCollection(metaDataUrl);
      if (!deployedAddress) {
        throw new Error(`[collId=${coll.id}] Deploying on-chain returned a null address`);
      }

      // 2e) Update row in DB
      await db
        .update(tokenCampaignNftCollections)
        .set({
          address: deployedAddress,
          metadataUrl: metaDataUrl,
        })
        .where(eq(tokenCampaignNftCollections.id, coll.id))
        .execute();

      logger.log(`Deployed collection ID=${coll.id}, address=${deployedAddress}, metaUrl=${metaDataUrl}`);
    } catch (error) {
      logger.error(`Error deploying collection ID=${coll.id}: `, error);
      // Decide if you want to continue or re-throw. This code continues to next item.
    }
  }
}
