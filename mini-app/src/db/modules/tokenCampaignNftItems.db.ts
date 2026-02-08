import { db } from "@/db/db";
import { eq, inArray, and } from "drizzle-orm";
import { tokenCampaignNftItems } from "@/db/schema/tokenCampaignNftItems";
import { tokenCampaignNftCollections } from "@/db/schema/tokenCampaignNftCollections";
import { tokenCampaignUserSpins } from "@/db/schema/tokenCampaignUserSpins";

const getItemsByAddresses = async (nftAddresses: string[]) => {
  if (!nftAddresses.length) return [];

  const result = await db
    .select({
      nftItem: {
        itemId: tokenCampaignNftItems.itemId,
        itemType: tokenCampaignNftItems.itemType,
        nftAddress: tokenCampaignNftItems.nftAddress,
        index: tokenCampaignNftItems.index,
        owner: tokenCampaignNftItems.owner,
        mergeStatus: tokenCampaignNftItems.mergeStatus,
      },

      // Only columns we want from token_campaign_nft_collections
      collection: {
        id: tokenCampaignNftCollections.id,
        name: tokenCampaignNftCollections.name,
        campaignType: tokenCampaignNftCollections.campaignType,
        address: tokenCampaignNftCollections.address,
        image: tokenCampaignNftCollections.image,
      },
    })
    .from(tokenCampaignNftItems)
    .innerJoin(tokenCampaignUserSpins, eq(tokenCampaignUserSpins.id, tokenCampaignNftItems.itemId))
    .innerJoin(tokenCampaignNftCollections, eq(tokenCampaignNftCollections.id, tokenCampaignUserSpins.nftCollectionId))
    .where(and(inArray(tokenCampaignNftItems.nftAddress, nftAddresses), eq(tokenCampaignNftItems.itemType, "onion1")));

  return result;
  // each row looks like { nftItem: {...}, collection: {...} }
};

/**
 * Count how many of the supplied on–chain addresses are *platinum*
 * (collectionId = 4, itemType = "onion1").
 */
export const countPlatinumByAddresses = async (nftAddresses: string[]) => {
  if (!nftAddresses.length) return 0;

  const rows = await db
    .select({
      addr: tokenCampaignNftItems.nftAddress,
    })
    .from(tokenCampaignNftItems)
    .innerJoin(tokenCampaignNftCollections, eq(tokenCampaignNftCollections.address, tokenCampaignNftItems.collectionAddress))
    .where(
      and(
        inArray(tokenCampaignNftItems.nftAddress, nftAddresses),
        eq(tokenCampaignNftCollections.id, 4), // platinum collection
        eq(tokenCampaignNftItems.itemType, "merge_platinum")
      )
    )
    .execute();

  return rows.length;
};
export const tokenCampaignNftItemsDB = {
  getItemsByAddresses,
  countPlatinumByAddresses,
};
