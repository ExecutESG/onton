// server/jobs/deployMissingCollections.ts
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { NftApiCollections } from "@/db/schema/nftApiCollections";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { logger } from "@/server/utils/logger";
import { deployCollection } from "@/lib/nft";
import { Address } from "@ton/core";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";

export async function deployNFTApiCollections() {
  const rows = await nftApiCollectionsDB.getByStatus("CREATING");

  if (rows.length === 0) {
    logger.log("No NFT collections need deployment.");
    return;
  }
  for (const coll of rows) {
    await nftApiCollectionsDB.updateById(coll.id, { status: "MINTING" });
  }
  for (const coll of rows) {
    try {
      logger.log(`Deploying collection ID=${coll.id}...`);

      // a) (Optional) Validate again or call user callback
      const valid = await externalValidate(coll);
      if (!valid) {
        await nftApiCollectionsDB.updateById(coll.id, { status: "VALIDATION_FAILED" });
        continue; // move to next
      }
      const minterWallet = await nftApiMinterWalletsDB.findById(coll.minterWalletId);
      if (!minterWallet || !minterWallet?.mnemonic) {
        logger.error(`Minter wallet not found for collection ID=${coll.id}`);
        await nftApiCollectionsDB.updateById(coll.id, { status: "FAILED" });
        continue; // move to next
      }
      // b) Suppose you want to upload metadata
      //    This might be a structure: { name, desc, image, cover, social_links, royalties... }
      const metaObj = {
        name: coll.name,
        description: coll.description,
        image: coll.image,
        cover_image: coll.coverImage,
        social_links: coll.socialLinks,
        royalties: coll.royalties,
      };
      const metadataUrl = await uploadJsonToMinio(metaObj, "ontoncollection");
      logger.log(`Uploaded metadata to ${metadataUrl}`);
      // c) Deploy on-chain
      const onChainAddress = await deployCollection(metadataUrl, minterWallet.mnemonic);
      if (!onChainAddress) {
        throw new Error("Failed to deploy on chain");
      }

      const parsed = Address.parseFriendly(onChainAddress);
      const rawAddress = parsed.address.workChain + ":" + parsed.address.hash.toString("hex");
      logger.log(`Parsed address: ${rawAddress} from ${onChainAddress}`);
      // d) Mark as completed
      await nftApiCollectionsDB.updateById(coll.id, {
        address: rawAddress,
        friendlyAddress: onChainAddress,
        status: "COMPLETED",
      });

      logger.log(`Collection #${coll.id} deployed at address=${onChainAddress}  / ${rawAddress} metadataUrl=${metadataUrl}`);
    } catch (err) {
      logger.error(`Error deploying collection #${coll.id}`, err);
      // set status=FAILED so user sees it's not minted
      await nftApiCollectionsDB.updateById(coll.id, { status: "FAILED" });
    }
  }
}

async function externalValidate(coll: NftApiCollections): Promise<boolean> {
  // Possibly call coll.userCallbackUrl or some external check
  // We'll mock it as always true
  logger.log(`Validating collection ID=${coll.id}...`);
  return true;
}
