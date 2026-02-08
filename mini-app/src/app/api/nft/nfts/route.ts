// app/api/nfts/route.ts (for the POST)
import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { parseCreateNFTBody } from "@/lib/NFTApi"; // from the Zod schemas
import { logger } from "@/server/utils/logger";

export async function POST(request: Request) {
  // 1) Handle CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 2) Authenticate
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // 3) Validate body
    const { walletAddress, nftData, userCallbackUrl } = await parseCreateNFTBody(request);

    // 4) Ensure minter wallet belongs to this apiKey
    const walletRow = await nftApiMinterWalletsDB.findByAddress(apiKeyRecord.id, walletAddress);
    if (!walletRow) {
      return new Response(JSON.stringify({ error: "Wallet not found or not associated with this API key" }), {
        status: 404,
      });
    }

    // 5) Optionally, fetch the collection to ensure it belongs to same apiKey
    const collectionIdNum = parseInt(nftData.collectionId, 10);
    if (isNaN(collectionIdNum)) {
      return new Response(JSON.stringify({ error: "Invalid collectionId" }), { status: 400 });
    }
    const collection = await nftApiCollectionsDB.getById(collectionIdNum);
    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }
    if (collection.apiKeyId !== apiKeyRecord.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: collection belongs to a different API key" }), {
        status: 401,
      });
    }

    // 6) Insert into nft_api_items with status=CREATING
    const inserted = await nftApiItemsDB.create({
      collectionId: collectionIdNum,
      name: nftData.name,
      description: nftData.description,
      image: nftData.image,
      contentUrl: nftData.content_url ?? null,
      contentType: nftData.content_type ?? null,
      buttons: nftData.buttons ?? null,
      attributes: nftData.attributes ?? null,

      // On-chain placeholders
      address: null,
      friendlyAddress: null,
      nftIndex: null,
      ownerWalletAddress: walletAddress,
    });

    // 7) Return a response
    return new Response(
      JSON.stringify({
        nftId: inserted.id,
        address: inserted.address, // null
        friendlyAddress: inserted.friendlyAddress, // null
        nftIndex: inserted.nftIndex, // null
        status: inserted.status, // "CREATING"
        nftData,
      }),
      { status: 200 }
    );
  } catch (err) {
    // If it's our structured error
    if ((err as any)?.status && (err as any)?.errorBody) {
      return new Response(JSON.stringify((err as any).errorBody), { status: (err as any).status });
    }

    logger.error("POST /nfts error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
