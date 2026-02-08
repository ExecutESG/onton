// app/api/nfts/[nftId]/status/route.ts
import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiItemsDB } from "@/db/modules/nftApiItems.db";
import { logger } from "@/server/utils/logger";
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db"; // if you want to cross-check collection ownership

export async function GET(request: Request, { params }: { params: { nftId: string } }) {
  // 1) Auth
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // parse
    const id = parseInt(params.nftId, 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid nftId param" }), { status: 400 });
    }

    // fetch item
    const item = await nftApiItemsDB.getById(id);
    if (!item) {
      return new Response(JSON.stringify({ error: "NFT item not found" }), { status: 404 });
    }

    // fetch the collection to verify same apiKey
    // We do a quick check:
    //  - find the collection
    //  - check if collection.apiKeyId === apiKeyRecord.id
    const collection = await nftApiCollectionsDB.getById(item.collectionId);
    if (!collection) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }
    if (collection.apiKeyId !== apiKeyRecord.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: collection belongs to a different API key" }), {
        status: 401,
      });
    }

    // Construct response
    const responseBody = {
      nftId: item.id.toString(),
      address: item.address,
      friendlyAddress: item.friendlyAddress,
      nftIndex: item.nftIndex,
      status: item.status,
      nftData: {
        // original metadata
        collectionId: item.collectionId.toString(),
        name: item.name,
        description: item.description,
        image: item.image,
        content_url: item.contentUrl,
        content_type: item.contentType,
        buttons: item.buttons,
        attributes: item.attributes,
      },
    };

    return new Response(JSON.stringify(responseBody), { status: 200 });
  } catch (err) {
    logger.error("GET /nfts/:nftId/status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
