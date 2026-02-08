// app/api/collections/[collectionAddress]/nfts/first-owner/route.ts
import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { logger } from "@/server/utils/logger";
import { rawToFriendlyAddress } from "@/server/utils/rawToFriendlyAddress";

export async function GET(request: Request, { params }: { params: { collectionAddress: string } }) {
  // 1) Authenticate
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // 2) Parse path param
    const { collectionAddress } = params;
    if (!collectionAddress) {
      return new Response(JSON.stringify({ error: "collectionAddress is required" }), { status: 400 });
    }

    // 3) Find the collection by raw address (or possibly by friendly if needed).
    //    We'll assume your DB stores 'address' as the raw or user-supplied string
    const collection = await nftApiCollectionsDB.getByAddress(collectionAddress);
    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }

    // 4) For the same API key, find all minter wallets
    const userMinterWallets = await nftApiMinterWalletsDB.findByApiKey(apiKeyRecord.id);
    if (userMinterWallets.length === 0) {
      // The user doesn't have any wallets? Then no items
      return new Response(
        JSON.stringify({
          collectionAddress: collection.address,
          friendlyAddress: collection.friendlyAddress,
          minterAddress: collection.minterWalletId, // or store the actual address if you have it
          nfts: [],
        }),
        { status: 200 }
      );
    }
    // Build a set of addresses
    const userWalletAddresses = new Set(userMinterWallets.map((w) => w.walletAddress.toLowerCase()));

    // 5) Query nft items that match this collection.
    //    We'll assume your nftApiItems table stores collection's on-chain address in `collectionAddress`.
    //    If your schema uses something else, adapt the code in the DB module.

    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }
    const items = await nftApiItemsDB.findAllByCollectionId(collection.id);

    // 6) Filter so only items whose firstOwnerAddress is in the user's wallet set
    //    (Note: if your DB has 'firstOwnerAddress' or 'ownerWalletAddress', adapt as needed)
    const filteredItems = items.filter((it) =>
      it.ownerWalletAddress ? userWalletAddresses.has(it.ownerWalletAddress.toLowerCase()) : false
    );

    // 7) Transform them to the shape required by the NFTItem schema
    //    (nftId, address, friendlyAddress, nftIndex, name, description, image, content_url, content_type, attributes, firstOwnerAddress, currentOwnerAddress)

    const nftItems = filteredItems.map((it) => ({
      nftId: it.id.toString(),
      address: it.address,
      friendlyAddress: it.friendlyAddress,
      nftIndex: it.nftIndex,
      name: it.name || "",
      description: it.description || "",
      image: it.image || "",
      content_url: it.contentUrl || null,
      content_type: it.contentType || null,
      attributes: it.attributes || [],
      // We assume 'ownerWalletAddress' is also the 'firstOwnerAddress' if minted by them?
      // If you store firstOwnerAddress separately, use that
      firstOwnerAddress: it.ownerWalletAddress || "",
      firstOwnerAddressFriendly: rawToFriendlyAddress(it.ownerWalletAddress || ""),
    }));

    // 8) Build final JSON
    const responseBody = {
      collectionAddress: collection.address,
      friendlyAddress: collection.friendlyAddress,
      // The wallet address that created this collection
      // If your schema has 'minterWalletId' => we find that row or we store an actual field in 'collection.minterWalletAddress' or something
      minterAddress: await nftApiMinterWalletsDB.findById(collection.minterWalletId),
      nfts: nftItems,
    };

    return new Response(JSON.stringify(responseBody), { status: 200 });
  } catch (error) {
    logger.error("GET /collections/:collectionAddress/nfts/first-owner error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
