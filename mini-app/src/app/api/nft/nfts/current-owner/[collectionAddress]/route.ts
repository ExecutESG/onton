import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { fetchNFTItems, NFTItem as TonCenterItem } from "@/services/tonCenter";
import { logger } from "@/server/utils/logger";
import axios from "axios";
import { rawToFriendlyAddress } from "@/server/utils/rawToFriendlyAddress";

export async function GET(request: Request, { params }: { params: { collectionAddress: string } }) {
  // 1) Auth
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // 2) parse path param
    const { collectionAddress } = params;
    if (!collectionAddress) {
      return new Response(JSON.stringify({ error: "collectionAddress is required" }), { status: 400 });
    }

    // parse limit/offset
    const url = new URL(request.url);
    const limitStr = url.searchParams.get("limit");
    const offsetStr = url.searchParams.get("offset");
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    // 3) find collection in DB
    const collection = await nftApiCollectionsDB.getByAddress(collectionAddress);
    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }

    // 4) find user’s minter wallets
    const userWallets = await nftApiMinterWalletsDB.findByApiKey(apiKeyRecord.id);
    if (userWallets.length === 0) {
      // no wallets => empty
      return new Response(
        JSON.stringify({
          collectionAddress: collection.address,
          friendlyAddress: collection.friendlyAddress,
          minterAddress: collection.minterWalletId,
          nfts: [],
        }),
        { status: 200 }
      );
    }

    // 5) For each wallet, fetch from TonCenter
    let allItems: TonCenterItem[] = [];
    for (const wallet of userWallets) {
      try {
        const data = await fetchNFTItems("", collectionAddress, "", -1, limit, offset);
        if (!data || !data.nft_items) {
          logger.log(`No items from TonCenter for wallet=${wallet.walletAddress}`);
          continue;
        }
        logger.log(
          `Fetched ${data.nft_items.length} items from TonCenter for wallet=${wallet.walletAddress}`,
          data.nft_items
        );
        allItems.push(...data.nft_items);
      } catch (err) {
        logger.error(`Error fetchNFTItems for wallet=${wallet.walletAddress}`, err);
      }
    }

    // Deduplicate by address
    const itemsMap = new Map<string, TonCenterItem>();
    for (const i of allItems) {
      itemsMap.set(i.address, i);
    }
    const arrayOfItems = Array.from(itemsMap.values());

    // 6) Look up "first owner" from DB
    //    We'll query items with collectionId=collection.id.
    //    Then store a map: { [onChainAddress]: firstOwnerWalletAddress }
    const dbItems = await nftApiItemsDB.getAllByCollectionId(collection.id);
    const firstOwnerMap = new Map<string, string>();
    for (const dbi of dbItems) {
      if (!dbi.address || !dbi.ownerWalletAddress) continue;
      // The assumption: dbi.ownerWalletAddress => first owner
      firstOwnerMap.set(dbi.address, dbi.ownerWalletAddress.toUpperCase() || "");
    }

    // 7) Build final result array, merging firstOwner + currentOwner data
    //    Also fetch metadata if you want
    const finalList = await Promise.all(
      arrayOfItems.map(async (tcItem) => {
        // parse metadata if desired
        let name = "";
        let description = "";
        let image = "";
        let contentUrl: string | null = null;
        let contentType: string | null = null;
        // or attributes, etc.

        // if we have content?.uri from toncenter
        if (tcItem.content?.uri) {
          try {
            const resp = await axios.get(tcItem.content.uri, { timeout: 5000 });
            const meta = resp.data;
            name = meta.name || "";
            description = meta.description || "";
            image = meta.image || "";
            contentUrl = meta.content_url || null;
            contentType = meta.content_type || null;
          } catch (fetchErr) {
            logger.error(`Metadata fetch error: ${fetchErr}`);
          }
        }

        // The first owner is from DB, default to empty if not found
        const firstOwnerAddress = firstOwnerMap.get(tcItem.address) ?? "";
        const firstOwnerAddressFriendly = rawToFriendlyAddress(firstOwnerAddress);
        const currentOwnerAddress = tcItem.owner_address || "";
        const currentOwnerAddressFriendly = rawToFriendlyAddress(currentOwnerAddress);
        return {
          nftId: "0", // no DB ID => "0"
          address: tcItem.address,
          friendlyAddress: tcItem.address, // parse if needed
          nftIndex: parseInt(tcItem.index, 10) || 0,
          name,
          description,
          image,
          content_url: contentUrl,
          content_type: contentType,
          attributes: [], // or meta.attributes if you store them
          firstOwnerAddress,
          firstOwnerAddressFriendly,
          currentOwnerAddress,
          currentOwnerAddressFriendly,
        };
      })
    );

    // 8) respond
    const body = {
      collectionAddress: collection.address,
      friendlyAddress: collection.friendlyAddress,
      minterAddress: await findMinterAddress(collection.minterWalletId),
      nfts: finalList,
    };
    return new Response(JSON.stringify(body), { status: 200 });
  } catch (error) {
    logger.error("GET /collections/:collectionAddress/nfts/current-owner error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

// helper
async function findMinterAddress(minterWalletId: number): Promise<string> {
  const row = await nftApiMinterWalletsDB.findById(minterWalletId);
  return row?.walletAddress || "";
}
