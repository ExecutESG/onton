import { db } from "@/db/db";
import { tokenCampaignMergeTransactions } from "@/db/schema/tokenCampaignMergeTransactions";
import { tokenCampaignNftItems } from "@/db/schema/tokenCampaignNftItems";
import { tokenCampaignNftCollections, TokenCampaignNftItemMetaData } from "@/db/schema/tokenCampaignNftCollections";
import { eq, inArray, isNull, count, and, asc } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { mintNFT } from "@/lib/nft"; // your existing helper for on-chain mint
import { uploadJsonToMinio } from "@/lib/minioTools";
import { sleep } from "@/utils";
import { coupon_definition } from "@/db/schema/coupon_definition";

/**
 * Mints a "Platinum" NFT (collection ID=4) for each row in token_campaign_merge_transactions
 * that doesn't yet have a .platinumNftAddress.  Also sets old NFT items => merged, storing
 * the new NFT address/index in mergedIntoNftAddress/mergedIntoNftIndex, and sets
 * token_campaign_merge_transactions.platinumNftAddress as well.
 *
 * The minted Platinum NFT metadata includes a new "merged_from" field with the old addresses/indices.
 */
export async function mintPlatinumNftForMergedNFTS() {
  // logger.log("mintPlatinumNftForMergedNFTS: started...");

  // 1) Find all merges that haven't minted Platinum yet
  const mergesToMint = await db
    .select()
    .from(tokenCampaignMergeTransactions)
    .where(
      and(isNull(tokenCampaignMergeTransactions.platinumNftAddress), eq(tokenCampaignMergeTransactions.status, "completed"))
    )
    .limit(1)
    .orderBy(asc(tokenCampaignMergeTransactions.id))
    .execute();

  if (!mergesToMint.length) {
    //logger.log("mintPlatinumNftForMergedNFTS: No merges waiting for platinum minting. Exiting...");
    return;
  }

  // 2) Load the "Platinum" collection with id=4
  const [platinumColl] = await db
    .select()
    .from(tokenCampaignNftCollections)
    .where(eq(tokenCampaignNftCollections.id, 4))
    .execute();

  if (!platinumColl) {
    logger.error("mintPlatinumNftForMergedNFTS: Platinum collection (id=4) not found. Exiting...");
    return;
  }
  if (!platinumColl.address) {
    logger.error("mintPlatinumNftForMergedNFTS: Platinum collection has no on-chain address. Exiting...");
    return;
  }

  for (const mergeRow of mergesToMint) {
    logger.log(
      `mintPlatinumNftForMergedNFTS: mintPlatinumNftForMergedUsers: Using platinum collection => ${platinumColl.address}`
    );
    const userWallet = mergeRow.walletAddress.trim();
    logger.log(`\n\n[mintPlatinumNftForMergedNFTS] Processing mergeRow #${mergeRow.id} => userWallet=${userWallet}`);

    const goldAddr = mergeRow.goldNftAddress;
    const silverAddr = mergeRow.silverNftAddress;
    const bronzeAddr = mergeRow.bronzeNftAddress;

    if (!goldAddr || !silverAddr || !bronzeAddr) {
      logger.error(
        `[mintPlatinumNftForMergedNFTS] Merge row #${mergeRow.id} missing gold/silver/bronze addresses. Skipping.`
      );
      continue;
    }

    // We'll do a DB transaction so all steps are atomic
    await db.transaction(async (tx) => {
      // i) Re-check old items from DB: must be "merging" so we can set them => "merged"
      const oldItems = await tx
        .select()
        .from(tokenCampaignNftItems)
        .where(
          and(
            inArray(tokenCampaignNftItems.nftAddress, [goldAddr, silverAddr, bronzeAddr]),
            eq(tokenCampaignNftItems.mergeStatus, "merging")
          )
        )
        .execute();

      if (oldItems.length !== 3) {
        logger.warn(
          `[mintPlatinumNftForMergedNFTS] Merge row #${mergeRow.id} => old items not found or not "merging". Skipping.`
        );
        return;
      }

      // Extract data for metadata
      // We'll also store them into "merged_from" in the final NFT
      const mergedFrom = oldItems.map((o) => ({
        address: o.nftAddress,
        index: o.index,
      }));

      // ii) Get next index for Platinum collection
      const nextIndex = (platinumColl.lastRegisteredItemIndex ?? 0) + 1;
      if (!platinumColl.address) {
        logger.error("mintPlatinumNftForMergedNFTS: Platinum collection has no on-chain address. Exiting...");
        throw new Error("mintPlatinumNftForMergedNFTS: Platinum collection has no on-chain address");
      }
      // iii) Count how many minted so far for naming (#1, #2, etc.)
      const [mintedCount] = await tx
        .select({ minted: count() })
        .from(tokenCampaignNftItems)
        .where(eq(tokenCampaignNftItems.collectionAddress, platinumColl.address))
        .execute();

      const mintedSoFar = Number(mintedCount.minted) || 0;
      const nextNumber = mintedSoFar + 1;

      // iv) Build final metadata
      // We'll add "merged_from" to the attributes or a top-level field
      const baseItemData = (platinumColl.itemMetaData as TokenCampaignNftItemMetaData) || {};
      const existingAttributes = baseItemData.attributes || [];
      const finalAttributes = [...existingAttributes];

      // We add a new "merged_from" attribute containing the addresses/indexes
      finalAttributes.push({
        merged_from: mergedFrom,
      });

      const finalItemData = {
        name: (baseItemData.name ?? platinumColl.name) + ` #${nextNumber}`,
        description: baseItemData.description ?? platinumColl.description,
        image: baseItemData.image ?? platinumColl.image,
        animation_url: baseItemData.animation_url,
        content_url: baseItemData.content_url,
        content_type: baseItemData.content_type,
        cover_image: baseItemData.cover_image,
        social_links: baseItemData.social_links,
        links: baseItemData.links,
        buttons: baseItemData.buttons,
        attributes: finalAttributes,
      };

      // v) Upload to Minio
      const metaDataUrl = await uploadJsonToMinio(finalItemData, "ontonitem");
      if (!metaDataUrl) {
        logger.error(`[mintPlatinumNftForMergedNFTS] row #${mergeRow.id}: failed to upload metadata. Aborting TX.`);
        throw new Error("mintPlatinumNftForMergedNFTS: Failed to upload platinum metadata");
      }

      // vi) Mint NFT on-chain
      // You have a function mintNFT(ownerWallet, collectionAddress, index, metadataUrl)
      const platinumAddressOnChain = await mintNFT(userWallet, platinumColl.address, nextIndex, metaDataUrl);

      if (!platinumAddressOnChain) {
        logger.error(`[mintPlatinumNftForMergedNFTS] row #${mergeRow.id} => mint returned null. Failing TX.`);
        throw new Error("mintPlatinumNftForMergedNFTS: Mint returned null");
      }

      // vii) Update DB in transaction
      // 1) Bump lastRegisteredItemIndex in the platinum collection
      await tx
        .update(tokenCampaignNftCollections)
        .set({ lastRegisteredItemIndex: nextIndex })
        .where(eq(tokenCampaignNftCollections.id, 4))
        .execute();

      // 2) Insert the new platinum item
      // We can store "owner" as oldItems[0].owner if all have same user, or 0
      const ownerUserId = oldItems[0].owner;
      await tx
        .insert(tokenCampaignNftItems)
        .values({
          itemId: mergeRow.id, // references the merge row
          itemType: "merge_platinum",
          nftAddress: platinumAddressOnChain,
          index: nextIndex,
          collectionAddress: platinumColl.address,
          owner: ownerUserId,
          mergeStatus: "not_allowed_to_merge",
        })
        .execute();

      // 3) Mark old items => "merged", store new platinum address
      await tx
        .update(tokenCampaignNftItems)
        .set({
          mergeStatus: "merged",
          mergedIntoNftAddress: platinumAddressOnChain,
          mergedIntoNftIndex: nextIndex,
        })
        .where(inArray(tokenCampaignNftItems.nftAddress, [goldAddr, silverAddr, bronzeAddr]))
        .execute();

      // 4) Mark the merge row => platinum minted
      await tx
        .update(tokenCampaignMergeTransactions)
        .set({ platinumNftAddress: platinumAddressOnChain })
        .where(eq(tokenCampaignMergeTransactions.id, mergeRow.id))
        .execute();

      logger.log(
        `[mintPlatinumNftForMergedNFTS] row #${mergeRow.id}: minted Platinum => ${platinumAddressOnChain}. Old items => merged.`
      );
    }); // end transaction

    // optional small sleep
    await sleep(10000);
  }

  logger.log("mintPlatinumNftForMergedNFTS: completed.");
}
