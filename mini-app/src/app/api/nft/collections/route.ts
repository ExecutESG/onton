import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { logger } from "@/server/utils/logger";
import { NFTApi } from "@/lib/NFTApi";

export async function POST(request: Request) {
  // 1) Handle Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 2) Authenticate
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError; // 401 or 500
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // 3) Parse body

    const { walletAddress, collectionData, userCallbackUrl } = await NFTApi.parseCreateCollectionBody(request);
    const walletRow = await nftApiMinterWalletsDB.findByAddress(apiKeyRecord.id, walletAddress);
    if (!walletRow) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 404 });
    }

    // 5) Insert a row in nft_api_collections with "CREATING"
    const inserted = await nftApiCollectionsDB.create({
      minterWalletId: walletRow.id,
      apiKeyId: apiKeyRecord.id,

      name: collectionData.name,
      description: collectionData.description,
      image: collectionData.image,
      coverImage: collectionData.cover_image,
      socialLinks: collectionData.social_links ?? null,
      royalties: collectionData.royalties.toString() ?? null,
      lastRegisteredIndex: -1,
      // We start with no address and status "CREATING"
      address: null,
      friendlyAddress: null,
    });

    // Optionally, store userCallbackUrl in a separate table or column if you want to use it later
    // For now, we skip it or store it in the collection row if you have a column

    // 6) Return success
    return new Response(
      JSON.stringify({
        collectionId: inserted.id,
        address: inserted.address, // null
        status: inserted.status, // "CREATING"
        minterAddress: walletAddress,
        collectionData, // the data user provided
      }),
      { status: 200 }
    );
  } catch (err) {
    logger.error("POST /collections error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
