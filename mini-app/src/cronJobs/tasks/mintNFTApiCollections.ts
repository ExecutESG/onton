import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { NftApiItems } from "@/db/schema/nftApiItems";
import { logger } from "@/server/utils/logger";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { mintNFT } from "@/lib/nft";
import { Address } from "@ton/core";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";

export async function mintNFTApiCollections() {
  // 1) fetch items with status=CREATING, or address is null
  const items = await nftApiItemsDB.getItemsByStatus("CREATING");
  if (items.length === 0) {
    logger.log("No NFT items to deploy right now.");
    return;
  }
  for (const item of items) {
    await nftApiItemsDB.updateById(item.id, { status: "MINTING" });
  }
  for (const item of items) {
    try {
      // a) Validate or external callback
      const valid = await externalValidate(item);
      if (!valid) {
        await nftApiItemsDB.updateById(item.id, { status: "VALIDATION_FAILED" });
        continue;
      }

      if (!item.ownerWalletAddress || !item.collectionId) {
        logger.error(`Item #${item.id} is missing ownerWalletAddress or collectionId`);
        await nftApiItemsDB.updateById(item.id, { status: "FAILED" });
        continue;
      }

      // b) build metadata
      const metaObj = {
        name: item.name,
        description: item.description,
        image: item.image,
        content_url: item.contentUrl,
        content_type: item.contentType,
        buttons: item.buttons,
        attributes: item.attributes,
      };
      const metadataUrl = await uploadJsonToMinio(metaObj, "ontonitem");
      if (!metadataUrl) {
        throw new Error(`Failed uploading metadata for item #${item.id}`);
      }

      // c) we need the parent collection address, if the item is minted under a collection
      // So either we join collection at DB level or store the collection address in the item row.
      // For example, we fetch the collection:
      const collection = await nftApiCollectionsDB.getById(item.collectionId);
      if (!collection || !collection.address) {
        throw new Error(`Collection missing on-chain address for item #${item.id}`);
      }
      const minterWallet = await nftApiMinterWalletsDB.findById(collection.minterWalletId);
      if (!minterWallet || !minterWallet?.mnemonic) {
        logger.error(`Minter wallet not found for collection ID=${collection.id}  and item #${item.id}`);
        await nftApiItemsDB.updateById(collection.id, { status: "FAILED" });
        continue; // move to next
      }
      // d) determine the next index or the user-supplied index
      //   For example, let's say we do a simple "collection.lastItemIndex + 1"
      const nextIndex = collection.lastRegisteredIndex + 1;

      // e) do the on-chain mint
      const mintedAddress = await mintNFT(
        item.ownerWalletAddress,
        collection.address,
        nextIndex,
        metadataUrl,
        minterWallet.mnemonic
      );
      if (!mintedAddress) {
        throw new Error(`Minting on-chain returned null for item #${item.id}`);
      }

      // f) parse raw address

      const addressObj = Address.parse(mintedAddress);

      const friendlyAddress = addressObj.toString({
        bounceable: true, // usually true for user-facing addresses
        testOnly: true, // set false if you’re on mainnet
      });

      // g) update item row
      await nftApiItemsDB.updateById(item.id, {
        address: mintedAddress,
        friendlyAddress: friendlyAddress,
        nftIndex: nextIndex,
        status: "COMPLETED",
      });
      await nftApiCollectionsDB.setLastRegisteredIndex(collection.id, nextIndex);

      logger.log(
        `Item #${item.id} minted => raw=${mintedAddress}, friendly=${friendlyAddress}, index=${nextIndex}, metaUrl=${metadataUrl}`
      );
    } catch (err) {
      logger.error(`Error deploying item #${item.id}`, err);
      await nftApiItemsDB.updateById(item.id, { status: "FAILED" });
    }
  }
}

async function externalValidate(item: NftApiItems): Promise<boolean> {
  // Possibly call item.userCallbackUrl or something
  // We'll mock true
  logger.log(`Validating item #${item.id}...`);
  return true;
}
