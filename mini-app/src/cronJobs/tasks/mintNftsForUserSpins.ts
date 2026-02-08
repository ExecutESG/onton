import { db } from "@/db/db";
import { tokenCampaignUserSpins } from "@/db/schema/tokenCampaignUserSpins";
import { tokenCampaignOrders } from "@/db/schema/tokenCampaignOrders";
import { TokenCampaignNftItemMetaData, tokenCampaignNftCollections } from "@/db/schema/tokenCampaignNftCollections";
import { tokenCampaignNftItems } from "@/db/schema/tokenCampaignNftItems";
import { eq, and, isNotNull, desc, asc, lte, count } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { mintNFT } from "@/lib/nft"; // your existing helper
import { uploadJsonToMinio } from "@/lib/minioTools";
import { sleep } from "@/utils";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";

export async function mintNftForUserSpins() {
  // logger.log("Starting mintNftForUserSpins...");
  // 1) Find user spins that require minting.
  const spinsToMint = await db
    .select()
    .from(tokenCampaignUserSpins)
    .where(and(isNotNull(tokenCampaignUserSpins.nftCollectionId), eq(tokenCampaignUserSpins.isMinted, false)))
    .orderBy(asc(tokenCampaignUserSpins.id))
    .execute();

  if (spinsToMint.length === 0) {
    // logger.log("mintNftForUserSpins: No user spins to mint right now.");
    return;
  }

  // 2) Iterate over each spin and attempt to mint
  for (const spin of spinsToMint) {
    const { configProtected } = await fetchOntonSettings();
    if (!configProtected.ONTON_NFT_MINTING_ENABLED || configProtected.ONTON_NFT_MINTING_ENABLED !== "ENABLED") {
      //logger.log("mintNftForUserSpins: NFT minting is disabled. Exiting...");
      return;
    }
    // get count  of minted spins by collectionId

    // Wrap in a transaction
    await db.transaction(async (trx) => {
      if (!spin.createdAt) {
        logger.error(`mintNftForUserSpins: 🔴 Spin createdAt is null for spinId=${spin.id}`);
        return;
      }
      const [order] = await trx
        .select({
          wallet: tokenCampaignOrders.wallet_address,
          uuid: tokenCampaignOrders.uuid,
        })
        .from(tokenCampaignOrders)
        .where(
          and(
            eq(tokenCampaignOrders.userId, spin.userId),
            isNotNull(tokenCampaignOrders.wallet_address),
            lte(tokenCampaignOrders.createdAt, spin.createdAt),
            eq(tokenCampaignOrders.status, "completed")
          )
        )
        .orderBy(desc(tokenCampaignOrders.createdAt))
        .limit(1)
        .execute();

      if (!order?.wallet) {
        logger.error(`mintNftForUserSpins: 🔴 No wallet address found for userId=${spin.userId}, spinId=${spin.id}`);
        return;
      }
      // 2a) Re-fetch spin in transaction
      const [freshSpin] = await trx
        .select()
        .from(tokenCampaignUserSpins)
        .where(eq(tokenCampaignUserSpins.id, spin.id))
        .execute();

      if (!freshSpin) {
        logger.error(`mintNftForUserSpins: 🔴 Spin not found or already handled: spinId=${spin.id}`);
        return;
      }
      if (freshSpin.isMinted) {
        logger.error(`mintNftForUserSpins: 🔴 Spin already minted: spinId=${spin.id}`);
        return;
      }
      if (!freshSpin.nftCollectionId) {
        logger.error(`mintNftForUserSpins: 🔴 Spin has no collectionId: spinId=${spin.id}`);
        return;
      }
      logger.log(`mintNftForUserSpins: 🟠 Processing spinId=${spin.id} for userId=${freshSpin.userId}`, spin);
      if (!freshSpin.createdAt) {
        logger.error(`mintNftForUserSpins: 🔴 Fresh spin createdAt is null for spinId=${spin.id}`);
        return;
      }

      // 3) Look up the related collection
      const [collection] = await trx
        .select()
        .from(tokenCampaignNftCollections)
        .where(eq(tokenCampaignNftCollections.id, freshSpin.nftCollectionId!))
        .execute();
      const [mintedCount] = await db
        .select({ count: count() })
        .from(tokenCampaignUserSpins)
        .where(
          and(
            eq(tokenCampaignUserSpins.nftCollectionId, freshSpin.nftCollectionId),
            eq(tokenCampaignUserSpins.isMinted, true)
          )
        )
        .execute();
      if (!collection) {
        logger.error(
          `mintNftForUserSpins: 🔴 No collection found for spinId=${spin.id}, collectionId=${freshSpin.nftCollectionId}`
        );
        return;
      }

      if (!collection.address) {
        logger.error(
          `mintNftForUserSpins: 🔴 Collection ${collection.id} missing on-chain address. Cannot mint spinId=${spin.id}.`
        );
        return;
      }
      if (!collection?.name || !collection?.description || !collection?.image) {
        logger.error(
          `mintNftForUserSpins: 🔴 Collection ${collection.id} missing required fields. Cannot mint spinId=${spin.id}.`,
          collection
        );
        return;
      }
      logger.log(`mintNftForUserSpins: Collection found for spinId=${spin.id}:`, collection);
      if (!freshSpin.createdAt) {
        logger.error(`mintNftForUserSpins: 🔴 Fresh spin createdAt is null for spinId=${spin.id}`);
        return;
      }
      // 4) Retrieve the user’s wallet address from orders

      const walletAddress = order.wallet.trim();
      logger.log(
        `mintNftForUserSpins: 🟠 Minting spinId=${spin.id} for userId=${freshSpin.userId} to wallet=${walletAddress}`
      );

      // 5) Determine the next NFT index
      const nextIndex = (collection.lastRegisteredItemIndex ?? 0) + 1;
      logger.log(
        `mintNftForUserSpins: 🟠 Next index for collection ${collection.id} is ${nextIndex} for spinId=${spin.id} and userId=${freshSpin.userId}`
      );

      // 6) Build final NFT metadata by merging:
      //    - collection.itemMetaData
      //    - fallback from collection name/description/image
      //    - spin-specific "spin_id"
      //    We'll store result in `finalItemData`.
      const baseItemData = (collection.itemMetaData as TokenCampaignNftItemMetaData) ?? {};

      const existingAttributes = baseItemData.attributes || [];

      // Suppose the user wants an object like { spin_id: freshSpin.id.toString() }
      const spinIdObject = { spin_id: freshSpin.id.toString() };

      // Now we just append that to the array
      const finalAttributes = [...existingAttributes, spinIdObject];

      // If itemMetaData already has "name", it will override. Otherwise fallback:
      const finalItemData = {
        name: (baseItemData.name ?? collection.name) + ` #${mintedCount.count + 1}`,
        description: baseItemData.description ?? collection.description,
        image: baseItemData.image ?? collection.image,
        // Merge optional fields from itemMetaData
        animation_url: baseItemData.animation_url,
        content_url: baseItemData.content_url,
        content_type: baseItemData.content_type,
        cover_image: baseItemData.cover_image,
        social_links: baseItemData.social_links,
        links: baseItemData.links,
        buttons: baseItemData.buttons,
        // Merge attributes, plus spin_id:
        attributes: finalAttributes,
      };

      // 7) Upload finalItemData to Minio
      logger.log("mintNftForUserSpins: 🟠 Final NFT item data:", finalItemData);
      const meta_data_url = await uploadJsonToMinio(finalItemData, "ontonitem");
      if (!meta_data_url) {
        logger.error(
          `mintNftForUserSpins: 🔴 Failed to upload metadata for spinId=${spin.id} and userId=${freshSpin.userId}`
        );
        return;
      }
      logger.log(`mintNftForUserSpins: 🟠 Uploaded metadata for spinId=${spin.id} to ${meta_data_url}`);

      // 8) Mint the NFT
      const nftAddressOnChain = await mintNFT(
        walletAddress, // user’s address
        collection.address, // the collection address on-chain
        nextIndex, // item index
        meta_data_url // URL to your JSON metadata
      );

      if (!nftAddressOnChain) {
        logger.error(
          `mintNftForUserSpins:  🔴 !!!!WTF :: Mint returned null for spinId=${spin.id}. Possibly failed on-chain. userId=${freshSpin.userId} wallet=${walletAddress}`
        );
        throw new Error(`mintNftForUserSpins: !!!!WTF :: Failed to mint NFT for spinId=${spin.id}`);
      }

      // 9) Update DB
      // 9a) Bump lastRegisteredItemIndex
      await trx
        .update(tokenCampaignNftCollections)
        .set({ lastRegisteredItemIndex: nextIndex })
        .where(eq(tokenCampaignNftCollections.address, collection.address))
        .execute();

      // 9b) Mark spin as minted
      await trx
        .update(tokenCampaignUserSpins)
        .set({ isMinted: true })
        .where(eq(tokenCampaignUserSpins.id, freshSpin.id))
        .execute();

      // 9c) Insert a record in `token_campaign_nft_items`
      await trx
        .insert(tokenCampaignNftItems)
        .values({
          itemId: freshSpin.id,
          itemType: collection.campaignType,
          nftAddress: nftAddressOnChain,
          index: nextIndex,
          collectionAddress: collection.address,
          owner: freshSpin.userId,
        })
        .execute();

      logger.log(
        `mintNftForUserSpins: 🟠🟠🟠 Minted spinId=${spin.id} => NFT ${nftAddressOnChain} for userId=${freshSpin.userId} at index ${nextIndex} wallet ${walletAddress}`
      );
      await sleep(3000);
    });
  }
}
