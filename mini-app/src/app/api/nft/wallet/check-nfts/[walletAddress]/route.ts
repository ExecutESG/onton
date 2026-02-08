import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { fetchNFTItems, NFTItem as TonCenterNFTItem } from "@/services/tonCenter";
import { logger } from "@/server/utils/logger";
import axios from "axios";
import { getAccountBalance } from "@/services/tonCenter";
import { rawToFriendlyAddress } from "@/server/utils/rawToFriendlyAddress";
/**
 * GET /nfts/wallet/check-nfts/{walletAddress}?collectionAddress=...&collectionAddress=...&friendlyAddress=...&limit=...
 *
 * This returns an array of collections with the NFT items (the user currently owns),
 * filtered optionally by "collectionAddress" query params.
 */
export async function GET(request: Request, { params }: { params: { walletAddress: string } }) {
  // 1) Authentication
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    // 2) Parse path param => "walletAddress"
    const { walletAddress } = params;
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "ownerAddress is required" }), { status: 400 });
    }

    // 3) Parse query params
    const url = new URL(request.url);
    // (optional) a user-friendly domain or ENS name
    const friendlyAddress = walletAddress ? rawToFriendlyAddress(walletAddress) : "";

    // array of addresses => e.g. ?collectionAddress=0xABC&collectionAddress=0xDEF
    const collectionAddresses = url.searchParams.getAll("collectionAddress"); // might be empty if none provided

    // optional limit/offset
    const limitStr = url.searchParams.get("limit");
    const offsetStr = url.searchParams.get("offset");
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    // 4) If no collectionAddress is provided,
    //    you can decide to:
    //    - Return all collections (from DB) that this user might own
    //    - Return an empty array
    //    - Or do some other logic
    // For example, let's assume we do "all collections in DB" to see if the user owns items in them:
    let dbCollections = [];
    if (collectionAddresses.length > 0) {
      // fetch each by address
      dbCollections = await Promise.all(
        collectionAddresses.map(async (addr) => {
          const c = await nftApiCollectionsDB.getByAddress(addr);
          return c || null;
        })
      );
      // remove null
      dbCollections = dbCollections.filter((c) => c !== null);
    } else {
      // Return all known collections from DB (or do your own logic)
      dbCollections = await nftApiCollectionsDB.getAllByApiKey(apiKeyRecord.id);
    }

    // If we have no DB collections => user might not have anything
    if (dbCollections.length === 0) {
      const responseBody = {
        walletAddress,
        friendlyAddress,
        collections: [],
      };
      return new Response(JSON.stringify(responseBody), { status: 200 });
    }

    // 5) For each collection, we fetch from TonCenter:
    //    -> current owner = userAddress, collectionAddress = ...
    //    -> Then we transform & store in a final array
    const finalCollections = [];

    for (const coll of dbCollections) {
      if (!coll?.address) continue;

      // fetch from TonCenter
      let tonItems: TonCenterNFTItem[] = [];
      try {
        const data = await fetchNFTItems(walletAddress, coll.address, "", -1, limit, offset);
        if (data?.nft_items) {
          tonItems = data.nft_items;
        }
      } catch (err) {
        logger.error(`Error fetching from TonCenter for collection ${coll.address} & user ${walletAddress}`, err);
        // We'll skip or produce an empty array
      }

      // Deduplicate if needed
      const mapByAddress = new Map<string, TonCenterNFTItem>();
      for (const i of tonItems) {
        mapByAddress.set(i.address, i);
      }
      const uniqueTonItems = Array.from(mapByAddress.values());

      // DB items => to get first owner or other local data
      const dbItems = await nftApiItemsDB.getAllByCollectionId(coll.id);
      // Build a map => { [nft_address]: { dbItem } }
      const dbMap = new Map<string, (typeof dbItems)[number]>();
      for (const dbi of dbItems) {
        if (dbi.address) {
          dbMap.set(dbi.address, dbi);
        }
      }

      // transform into the final "nfts" array
      const nfts = await Promise.all(
        uniqueTonItems.map(async (tcItem) => {
          // check DB for "firstOwnerAddress" or other data
          const dbItem = dbMap.get(tcItem.address);

          let name = "";
          let description = "";
          let image = "";
          let content_url: string | null = null;
          let content_type: string | null = null;
          let attributes: any[] = [];

          // fetch & parse metadata from `tcItem.content?.uri`
          if (tcItem.content?.uri) {
            try {
              const resp = await axios.get(tcItem.content.uri, { timeout: 5000 });
              const meta = resp.data;
              name = meta.name || "";
              description = meta.description || "";
              image = meta.image || "";
              content_url = meta.content_url || null;
              content_type = meta.content_type || null;
              attributes = meta.attributes || [];
            } catch (e) {
              logger.error(`Error fetching NFT metadata from ${tcItem.content.uri}`, e);
            }
          }

          return {
            nftId: dbItem?.id?.toString() || "0", // if no DB, just "0"
            address: tcItem.address, // raw NFT address
            friendlyAddress: tcItem.address, // parse to a friendlier version if you want
            nftIndex: parseInt(tcItem.index, 10) || 0,
            name,
            description,
            image,
            content_url,
            content_type,
            attributes,
            firstOwnerAddress: dbItem?.ownerWalletAddress || "", // from DB
            currentOwnerAddress: tcItem.owner_address || "", // from TonCenter
          };
        })
      );

      // build the "collection" object
      finalCollections.push({
        collectionAddress: coll.address,
        friendlyAddress: coll.friendlyAddress,
        minterAddress: await findMinterAddress(coll.minterWalletId),
        collectionData: {
          name: coll.name,
          description: coll.description,
          image: coll.image,
          cover_image: coll.coverImage,
          social_links: coll.socialLinks ?? [],
        },
        nfts,
      });
    }
    let walletBalance = "0";
    try {
      const bal = await getAccountBalance(walletAddress);
      walletBalance = bal.toString(); // e.g. "12.345"
    } catch (err) {
      logger.error(`Error fetching balance for walletAddress=${walletAddress}`, err);
      // we can continue with "0" or handle error
    }
    // 6) Build final response
    const responseBody = {
      walletAddress,
      walletBalance,
      friendlyAddress,
      collections: finalCollections,
    };

    return new Response(JSON.stringify(responseBody), { status: 200 });
  } catch (err) {
    logger.error("GET /nfts/owner/:ownerAddress error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

/** Helper to fetch the minter wallet address from the DB. */
async function findMinterAddress(minterWalletId: number) {
  const row = await nftApiMinterWalletsDB.findById(minterWalletId);
  return row?.walletAddress || "";
}
